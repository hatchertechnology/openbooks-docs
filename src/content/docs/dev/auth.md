---
title: Authentication
description: Password + passkey sign-in, the three middleware tiers, and the OAuth 2.1 authorization server that issues tokens to other clients.
sidebar:
  order: 5
---

Every route except `GET /health` requires authentication. Implemented in
`openbooks-api/src/auth/` (password, session, token, webauthn) and
`openbooks-api/src/oauth/` (the authorization server).

There is **no RBAC**. Authentication answers "who are you," never "may you" —
the `Credential` enum exists only so a handful of endpoints can refuse a
bearer token, not to model roles or permissions. Any authenticated user can
read and write the whole ledger, and an approved OAuth client gets the same
total access — there are no scopes anywhere in this system. That's
deliberate; see the project's root `CLAUDE.md`.

## Three middleware tiers

Every route sits behind exactly one of three `route_layer`s in `lib.rs`:

| Tier | Middleware | Accepts | Routes |
|---|---|---|---|
| Open | none | anything | `GET /health`; `POST /auth/login`, `POST /auth/logout`; the two `.well-known` documents; `GET /oauth/authorize`; `POST /oauth/token` |
| Half-session | `require_half_session` | a cookie session at **any** `mfa_complete` | `POST /auth/webauthn/register/begin`, `/register/finish`, `/auth/begin`, `/auth/finish` |
| Full | `require_user` | a bearer token, **or** a cookie session with `mfa_complete = true` | the ledger (`/accounts`, `/settings`, `/transactions`, `/reports/*`, `/mcp`), `GET /auth/me`, `POST /auth/password`, `GET /auth/passkeys`, `DELETE /auth/passkeys/{id}`, `POST /oauth/authorize/approve`, `GET /oauth/client_info` |

The open tier is open by necessity, not by oversight: login and logout are
how a session is created and destroyed, the `.well-known` documents are what
an unconfigured OAuth client reads before it has any credential,
`GET /oauth/authorize` is reached by a browser that may not be signed in yet,
and `POST /oauth/token` is authenticated by the authorization code or refresh
token the caller presents, not by a header or a cookie.

Within the full tier, a few routes narrow further and refuse a bearer token
even though `require_user` accepted one: `POST /auth/password`,
`DELETE /auth/passkeys/{id}`, and `POST /oauth/authorize/approve`. Each is a
credential-issuing or credential-destroying operation, and a bearer token is
a long-lived machine credential with no second factor behind it — letting
one perform any of these would turn a leaked token into a way to mint or
strip a human's own credentials.

## Signing in: password, then passkey

`POST /auth/login` takes `{ "email", "password" }` and, on a correct
password, creates a **half-session** — a cookie good for ten minutes
(`HALF_SESSION_MINUTES` in `auth::session`) that reaches the WebAuthn routes
and `/auth/logout`, and nothing else. The response reports `has_passkeys` and
`mfa_complete` (always `false` at this point):

```json
{ "has_passkeys": false, "mfa_complete": false }
```

A password is one factor and buys nothing by itself. `mfa_complete` becomes
`true` in exactly one place — `auth::webauthn::elevate` — and only after a
verified WebAuthn ceremony: either presenting an already-enrolled passkey
(`/auth/webauthn/auth/finish`) or, for an account with no passkey yet,
enrolling the first one (`/auth/webauthn/register/finish`). `elevate` rotates
the session id and extends `expires_at` to a fresh `SESSION_TTL_DAYS`, so a
cookie value observed or planted before the second factor is worthless after
it.

**The zero-credential registration gate.** A half-session may register a new
passkey unconditionally only while the account has none
(`auth::webauthn::may_register`, checked before both `register_begin` and
`register_finish`). The moment a first credential exists, adding a second one
needs a session that already has `mfa_complete = true` — a stolen password
alone is not enough to enrol an attacker's own passkey, because that would
let the attacker complete "the second factor" without ever touching the
victim's device.

Both ceremonies are two calls each — `begin` returns a WebAuthn challenge,
`finish` takes the browser's response — under `/auth/webauthn/`:

- `POST /auth/webauthn/register/begin` / `/register/finish`
- `POST /auth/webauthn/auth/begin` / `/auth/finish`

`auth_finish` refuses a ceremony the authenticator didn't verify the user for
(`result.user_verified()` false — bare possession of the device, no PIN or
biometric) and refuses a `sign_count` that goes backwards or stays flat when
it was previously nonzero (`counter_ok`) — the signal for a cloned
authenticator. A user with an enrolled passkey manages it from
`GET /auth/passkeys` (list) and `DELETE /auth/passkeys/{id}` (remove, session
only, and refused if it's the last one — `delete_passkey`'s `LastOne`
outcome, `409`).

## Backoff and session expiry

Unchanged from earlier phases and still worth restating: wrong passwords are
throttled per-account (`auth::password::verify`) — the first 3 failures cost
nothing, each one after that doubles a delay starting at 2 seconds and
capped at 15 minutes, and both a wrong password and an unknown email
produce the identical `401` so neither timing nor wording can be used to
enumerate accounts. A session's `expires_at` is fixed at creation and again
at elevation; using it never slides the deadline forward.

## The OAuth 2.1 authorization server

`openbooks-api` is its own authorization server and its own resource server
— same process, same Postgres pool, which is why token validation is a
`select` and there's no JWT anywhere. An approved grant is a bearer token
with total access to the ledger, exactly like a bearer token minted by `just
mint-token`, which is why only a full two-factor browser session can approve
one.

### The two `.well-known` documents

`GET /.well-known/oauth-protected-resource`:

```json
{
  "resource": "http://localhost:38081",
  "authorization_servers": ["http://localhost:38081"],
  "bearer_methods_supported": ["header"]
}
```

`GET /.well-known/oauth-authorization-server`:

```json
{
  "issuer": "http://localhost:38081",
  "authorization_endpoint": "http://localhost:38081/oauth/authorize",
  "token_endpoint": "http://localhost:38081/oauth/token",
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code", "refresh_token"],
  "code_challenge_methods_supported": ["S256"],
  "token_endpoint_auth_methods_supported": ["none"]
}
```

`issuer` and the two endpoint URLs come from `API_ORIGIN` (`canonical_resource()`
— lowercased, no trailing slash). Both documents live at the plain
`.well-known` path rather than a path-suffixed one, because the issuer here
has no path component of its own. `token_endpoint_auth_methods_supported:
["none"]` is accurate, not a placeholder: every registered client is public
(loopback, no client secret), and the token endpoint authenticates the
*request* — by the authorization code plus its PKCE verifier, or by a
refresh token — never the client.

### `GET /oauth/authorize`

Query params (`AuthorizeParams`): `client_id`, `redirect_uri`, `response_type`
(must be `code`), `code_challenge`, `code_challenge_method` (must be `S256`
— `plain` is rejected outright), `resource` (required — see below), and an
optional opaque `state`.

Validation (`authorize::validate`, shared with `approve` below so the two
can't drift apart on what a valid request is): the client must exist and the
`redirect_uri` must be one of its registered URIs (see the loopback rule
below); `response_type` must be `code`; `code_challenge_method` must be
`S256` and `code_challenge` at least 43 characters (an S256 challenge's
length); `resource` must resolve to this API. Any of these failing returns a
JSON `invalid_request`/`invalid_client` error directly, **not** a redirect —
sending a browser to an unvalidated `redirect_uri` is the open-redirect bug
this endpoint exists to avoid.

Once valid, it 303s the browser straight through, query string and all, to
`WEB_ORIGIN/authorize` (the Nuxt consent page — see
[Screens](/openbooks-docs/use/screens/)):

```
HTTP/1.1 303 See Other
Location: http://localhost:38080/authorize?client_id=...&redirect_uri=...&...
```

**It deliberately performs no session check.** A signed-out browser reaches
this endpoint fine and gets redirected to the consent page just the same; the
consent page's own middleware (the full tier) is what demands a session, and
only `POST /oauth/authorize/approve` ever mints anything. Checking here would
be redundant with that check and would leak "you're not signed in" through a
different door than the one that matters.

The raw query string is also checked byte-by-byte
(`authorize::query_is_safe`) for anything outside printable ASCII, whether
literal or `%`-encoded — a control byte here would go straight into a
`Location` header, which can split an HTTP response at a proxy, or would
decode back into the same control byte wherever the consent page parses it.

### `POST /oauth/authorize/approve`

The only thing in the system that mints an authorization code. Behind the
full tier, and additionally refuses anything but a full cookie session:

```json
{ "error": "invalid_client", "error_description": "approve a client from the web app, not with a token" }
```

with status `403` (not `401` — this is a caller who *is* authenticated, just
not with the right kind of credential; `403 Forbidden` says "not for you,"
which is the accurate read). **This is the load-bearing rule of the whole
authorization server:** a machine credential (a bearer token) must never be
able to mint another machine credential, or a leaked token becomes a way to
mint an unbounded number of further tokens for any client that will accept
one.

Request body (`ApproveBody`): every field from `AuthorizeParams` plus
`approve: bool`. The server re-validates the whole request itself — nothing
about a browser POST is trusted just because the consent page rendered it.

On `approve: false`:

```json
{ "redirect": "https://client.example/callback?error=access_denied&state=..." }
```

On `approve: true`, it inserts a row into `oauth_codes` (60-second TTL —
`CODE_TTL_SECONDS`), marks the client used (`first_used_at`/`last_used_at`),
and returns:

```json
{ "redirect": "https://client.example/callback?code=...&state=..." }
```

The response body is a JSON `{"redirect": "..."}`, not an HTTP redirect —
the target is a loopback listener on the user's own machine, not a page the
browser should navigate to via a `Location` header from this origin, so the
consent page does the navigation itself (`window.location.href = redirect`).

### `GET /oauth/client_info`

Behind the full tier, and — unlike `approve` — a bearer token is fine here:
reading a client's display name is not a credential operation. Reads the
name straight from `oauth_clients` rather than trusting anything in the
query, so a crafted link with a flattering `client_name` parameter can't
mislead the human whose approval is the real backstop:

```json
{ "id": "openbooks-cli", "name": "openbooks-cli", "dynamic": false, "first_use": true }
```

`dynamic` and `first_use` exist for a not-yet-built "you've never approved
this client before" warning (phase 4).

### `POST /oauth/token`

Form-encoded (`application/x-www-form-urlencoded`), per RFC 6749 §4.1.3 —
safe here even though form bodies are usually a CSRF concern, because this
endpoint reads no cookie and no session at all: it's authenticated entirely
by what's in the body, so a cross-site form POST has nothing to ride on.

`grant_type` selects one of two branches:

**`authorization_code`** — `code`, `redirect_uri`, `client_id`,
`code_verifier` all required; `resource`, if present, is checked against this
API. The code is looked up `for update` (so two simultaneous redemptions
can't both see it live), and PKCE is checked with S256 only
(`pkce_matches` — SHA-256 of the verifier, base64url, unpadded, must equal
the stored challenge).

**`refresh_token`** — `refresh_token` and `client_id` required; `resource`,
if present, checked the same way.

Every failure in either branch — expired, consumed, wrong client, wrong
redirect, bad PKCE, unknown token, revoked token — comes back as the
identical shape:

```json
{ "error": "invalid_grant", "error_description": "that code is not redeemable" }
```

(or `"that refresh token is not redeemable"` for the refresh branch). Telling
the caller which part was wrong tells an attacker too. The full error
vocabulary (`oauth::OAuthError`):

| Code | Status | When |
|---|---|---|
| `invalid_request` | 400 | missing/malformed params, bad PKCE shape, wrong `resource` |
| `invalid_grant` | 400 | code or refresh token not redeemable, for any reason |
| `invalid_client` | 401 (403 from `approve`, see above) | unknown client |
| `unsupported_grant_type` | 400 | anything but `authorization_code` or `refresh_token` |
| `server_error` | 500 | a database error |

Every response from `/oauth/token` — success or error — carries
`Cache-Control: no-store` (RFC 6749 §5.1): a token must never end up in a
shared or browser cache.

That table is the vocabulary `OAuthError` itself can produce; two more status
codes reach the caller before `token()` ever runs, from axum's own `Form`
extractor, and they are plain text, not the OAuth error shape: a
`POST /oauth/token` with no `grant_type` field at all is `422 Unprocessable
Entity`, and one sent with a `Content-Type` other than
`application/x-www-form-urlencoded` is `415 Unsupported Media Type`.

On success:

```json
{
  "access_token": "ob_...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "ob_..."
}
```

Access tokens live **one hour** (`ACCESS_TTL_HOURS`); refresh tokens live
**60 days** (`REFRESH_TTL_DAYS`). Both are 256 bits of random, prefixed
`ob_` (the same prefix and same digest scheme `auth::token::mint` uses for a
CLI-minted token), stored only as their SHA-256 — a database dump yields no
usable credential. Every token is audienced to `canonical_resource()`
(`resource` column on `oauth_tokens`), the same value every `.well-known`
document reports as `issuer` — this is RFC 8707 in practice: a token minted
for this API is meaningless presented anywhere else, and there's nowhere
else to present it, since this process is both the authorization server and
the only resource server.

**A code that fails redemption is killed, not merely refused** — including
on a `client_id` or `redirect_uri` mismatch, not just an outright replay.
This is a reviewed decision (see the comment at
`oauth/token.rs:authorization_code`): it accepts a denial-of-service against
whoever legitimately holds the code — a mismatch forces them to redo
consent — because the alternative, leaving a possibly-compromised code alive
for further attempts, is worse (RFC 9700). A PKCE mismatch kills the code the
same way.

### Refresh rotation and family revocation

Every redemption of a refresh token retires it and issues a brand-new pair
(`issue_pair`, chained to the retired token via `parent_hash`), a family
tree rooted at the original `authorization_code` grant. Presenting a retired
refresh token again — reuse — is handled by *when* it happens:

- **Within `REUSE_GRACE_SECONDS` (10 seconds)** of being retired: treated as
  an ordinary client retry (a double-submit, a flaky network), refused but
  the grant is left alone.
- **Outside that window**: treated as theft. `revoke_family` walks
  `parent_hash` recursively from the reused token and revokes every
  descendant — every refresh token and every access token minted from that
  point forward, including whichever pair the legitimate holder is currently
  using. Signing the user out entirely is the intended cost of a detected
  replay.

Both halves are deliberate and both are named constants for a reason: too
short a grace window turns an ordinary retry into a false "theft," and no
grace window at all makes rotation just a shorter-lived token rather than a
detector of anything. Auth0 and Okta apply the same asymmetry.

### The RFC 8252 loopback rule

`redirect_uri_allowed` (`oauth/clients.rs`) is exact string matching, with
one carve-out: two `http://` URIs whose host is the literal address
`127.0.0.1` or `[::1]` match while ignoring the **port** (RFC 8252 §7.3,
§8.4). `localhost` is deliberately *not* treated as loopback — a hostname can
be repointed by a resolver, the literal address can't.

Both first-party clients (`openbooks-cli`, `openbooks-desktop`) register
`http://127.0.0.1/callback` with no port at all. `openbooks-cli auth login`
binds an ephemeral OS-assigned port every run — it has to, since nothing
else on the machine can promise a fixed one is free — so the redirect it
actually presents is `http://127.0.0.1:54213/callback` this run and
`http://127.0.0.1:58831/callback` the next. Exact matching would break login
on every single run; the port-insensitive comparison is what makes the
loopback flow work at all.

The one thing this carve-out does **not** ignore is an authority containing
`@`. `http://127.0.0.1:1@attacker.example/callback` parses, under a naive
port-stripping split, as host `127.0.0.1` — because the split stops at the
first colon — while a browser actually sends the code to
`attacker.example`, the real host after the `@`. `loopback_key` refuses to
shortcut any authority with a `@` in it and falls through to exact string
matching, which rejects that URI outright.

### What doesn't exist yet

Named as such so nothing here is mistaken for a gap in this documentation
rather than in the server:

- **The device grant.** `oauth_device_codes` exists as a table already (a
  phase-4 head start), but no route reads or writes it, and
  `grant_type=device_code` isn't in the `token` match — it falls through to
  `unsupported_grant_type`.
- **`/oauth/register`.** No dynamic client registration. The only clients
  that exist are the two rows `0004_auth.sql` inserts; a third client is
  added by hand, in the database, not over HTTP.
- **`/oauth/revoke`.** No RFC 7009 endpoint. The only way to end a grant
  early today is a password change (`session::delete_all_for_user` +
  `token::revoke_all_for_user`) or `user passwd`/`user rm`, both of which end
  *everything* for that user, not one client's grant.
- **`DELETE /auth/tokens/{id}`.** No per-token revocation and no
  connected-clients UI to drive one from.
