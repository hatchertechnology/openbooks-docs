---
title: Authentication
description: Password login, sessions, bearer tokens, the 401 challenge, and what phase 1 deliberately leaves out.
sidebar:
  order: 2
---

Every route except `GET /health` requires authentication. Implemented in
`openbooks-api/src/auth/mod.rs` and `src/auth/routes.rs`.

There is **no RBAC**. Authentication answers "who are you," never "may you" —
the `Credential` enum exists only so `/auth/password` can refuse a bearer
token, not to model roles or permissions. Any authenticated user can read and
write the whole ledger. That's deliberate; see the project's root `CLAUDE.md`.

## Two credential types

| Credential | Who uses it | Carried as |
|---|---|---|
| Session cookie | the web app | `ob_session` cookie |
| Bearer token | every other client — `openbooks-cli`, `openbooks-desktop`, `/mcp`, scripts | `Authorization: Bearer <token>` header |

`require_user`, applied to every protected route with `route_layer`, checks
for a bearer token first, then falls back to the session cookie. A session
only counts if it's **fully authenticated** (`mfa_complete = true` in the
`sessions` table) — a half-session, which is what exists between posting a
password and completing a second factor, reaches nothing but the `/auth`
routes and never the ledger. Phase 1 has no second factor, so login raises a
session to fully authenticated immediately (see below).

Two of the four `/auth` routes don't need an existing identity — `POST
/auth/login` and `POST /auth/logout` are mounted on an open router, since
login is how you get a session and logout has to work even for someone
holding a half-session. `GET /auth/me` and `POST /auth/password` go through
`require_user` like the ledger routes.

## `POST /auth/login`

**Request body:**

```json
{ "email": "demo@example.com", "password": "..." }
```

**Response `200`**, with a `Set-Cookie: ob_session=...` header:

```json
{ "has_passkeys": false, "mfa_complete": true }
```

`has_passkeys` reports whether any WebAuthn credential exists for the
account — always `false` in phase 1, since nothing populates
`webauthn_credentials` yet. `mfa_complete` is always `true` in phase 1: the
handler rotates the session straight to fully authenticated after a correct
password, with a `ponytail:` comment in the source marking exactly the two
lines phase 2 deletes once a verified WebAuthn ceremony is the only thing
allowed to do that. **A stolen password alone yields a full session** — that
is what "no second factor" means here, and it's why WebAuthn 2FA follows
immediately in phase 2.

**Response `401`** on a wrong password, an unknown email, or an active
backoff delay — see [Login failures](#login-failures-are-indistinguishable-on-purpose)
below.

## `POST /auth/logout`

No request body. Deletes the session named by the `ob_session` cookie, if
one is present.

**Response `204`**, with `Set-Cookie` clearing the cookie (`Max-Age=0`).

## `GET /auth/me`

No params. Requires an authenticated caller — session or bearer token, either
one.

**Response `200`:**

```json
{ "id": "3f2a1c9e-...", "email": "demo@example.com" }
```

## `POST /auth/password`

Changes the password for the calling user. **Requires a session — refuses a
bearer token:**

**Response `403`**, if the caller authenticated with a bearer token:

```json
{ "error": "sign in through the web app to change a password" }
```

A bearer token is a long-lived machine credential with no second factor
behind it; letting one change a password would turn a leaked token into
permanent account takeover.

**Request body**, for a session caller:

```json
{ "current": "...", "new": "..." }
```

The handler checks `current` before validating `new`'s length, so an
unauthenticated-feeling failure never leaks which check tripped first to an
already-identified caller. `new` must be at least 12 characters (counted with
`.chars().count()`, so it's Unicode-scalar-aware, not byte length) or the
response is:

**Response `400`:**

```json
{ "error": "password must be at least 12 characters" }
```

**Response `401`**, if `current` doesn't match:

```json
{ "error": "authentication required" }
```

This is the same body `unauthorized()` produces for a missing credential
entirely — the handler doesn't distinguish "wrong current password" from "no
credential at all" in the response.

**Response `204`** on success, with `Set-Cookie` clearing the session cookie.
A successful password change **ends every session and revokes every bearer
token for that user**, including the one making this request — the same
`session::delete_all_for_user` and `token::revoke_all_for_user` calls the
admin `user passwd` command makes (see [Overview](/openbooks-docs/api/overview/)).
Changing a password is what someone does when they think they're
compromised, so it has to end access already in flight, not just future
logins.

## The 401 challenge

Every `unauthorized()` response — a missing credential, an expired session,
an invalid token — carries a `WWW-Authenticate` header pointing at a metadata
endpoint:

```
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer resource_metadata="http://localhost:38081/.well-known/oauth-protected-resource"
```

```json
{ "error": "authentication required" }
```

That metadata endpoint **does not exist in phase 1** — no `/oauth/*` routes,
no discovery document. The challenge is there so an MCP client can locate
where to authenticate without being manually configured, once phase 4 adds
OAuth. Nothing in phase 1 depends on the URL resolving; a phase 1 client
still gets `OPENBOOKS_TOKEN` out-of-band, from `just mint-token`.

## Login failures are indistinguishable on purpose

A wrong password and an unknown email both come back as the same `401` from
`POST /auth/login`, and both cost the same amount of work: an unknown email
still runs one argon2 verification, against a hash of a password nobody has,
so there's no timing difference between "no such user" and "wrong password"
to exploit for enumeration.

Backoff delays answer identically too. Once an account is in backoff (see
below), even the *correct* password is refused with the same plain `401` —
telling the caller "try again in 8 seconds" would itself confirm the account
exists. One consequence worth naming honestly: if the web app ever surfaces
this 401 as a message, a user who is delayed by backoff and a user who
mistyped their password see the identical wording. There's no way to tell
them apart from the response.

## Backoff

Wrong passwords are throttled per-account, in `auth::password::verify`:

- The first **3** failures cost nothing — a fat-fingered password is free.
- Each failure after that doubles the delay: the 4th failure imposes a 2
  second wait, the 5th 4 seconds, the 6th 8, and so on, capped at **15
  minutes**.
- A correct password submitted while a delay is in force is still refused —
  backoff isn't bypassed by finally getting it right.
- A successful login clears both the failure count and the delay.

The increment and the delay decision happen in one `UPDATE ... RETURNING`
statement per attempt, so concurrent guesses against the same account can't
race the counter and get the backoff for cheaper than serial guessing would.

**Residual, accepted for a POC:** because the delay doubles to a cap rather
than escalating without bound, an attacker willing to send one wrong guess
every fifteen minutes can keep a known account delayed indefinitely, without
ever getting locked out entirely. That's a smaller switch than a hard
account lock — which would let anyone who knows an email address flip a
stranger's account off — not the absence of one. This is a known, accepted
tradeoff for a POC, not an oversight.

## Sessions expire on a fixed horizon

A session's `expires_at` is set once, at creation and again when a session is
rotated to fully authenticated, to `now() + SESSION_TTL_DAYS` (see
[Overview](/openbooks-docs/api/overview/) for the env var and its default). It
does **not** slide forward on use — `session::lookup` touches `last_seen_at`
on every request but never extends `expires_at`. A stolen cookie has a
deadline that using it cannot push back.

A half-session (the ten minutes between posting a password and completing a
second factor) is shorter still, fixed at creation regardless of
`SESSION_TTL_DAYS` — not adjustable by anything phase 1 exposes.

## What phase 1 doesn't do

- **No second factor.** The WebAuthn tables (`webauthn_credentials`,
  `webauthn_challenges`) exist and the half-session machinery is wired and
  tested, but nothing populates a credential yet — `has_passkeys` is always
  `false`. Phase 2 adds the WebAuthn ceremony and removes the two lines in
  `login` that currently raise a session to fully authenticated by itself.
- **No OAuth.** No `/oauth/*` routes, no metadata document behind the 401
  challenge above.
- **No `auth login` in any client.** `openbooks-cli`, `openbooks-desktop`,
  and `/mcp` all read `OPENBOOKS_TOKEN` from the environment; see
  [CLI overview](/openbooks-docs/cli/overview/),
  [Desktop overview](/openbooks-docs/desktop/overview/), and
  [MCP server](/openbooks-docs/api/mcp/).
- **No revocation UI.** A token or session is only ended by a password
  change, `user passwd`, or `user rm` — see [Overview](/openbooks-docs/api/overview/).
