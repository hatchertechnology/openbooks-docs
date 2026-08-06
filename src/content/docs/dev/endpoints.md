---
title: Endpoints
description: Every HTTP route on openbooks-api — methods, params, request and response bodies, and status codes.
sidebar:
  order: 7
---

All routes are defined in the router in `openbooks-api/src/lib.rs`. Report
endpoints (`/reports/*`) have their own page: see [Reports](/openbooks-docs/dev/reports/).
The MCP endpoint (`/mcp`) is covered in [MCP server](/openbooks-docs/dev/mcp/).

## Authentication

Every route below, and every report and MCP route, requires a session cookie
or a bearer token. The only routes open to anyone are `GET /health`,
`POST /auth/login`/`logout`, the two `.well-known` documents,
`GET /oauth/authorize`/`POST /oauth/token`, `POST /oauth/device_authorization`,
`POST /oauth/register`, and `POST /oauth/revoke` — see [OAuth](#oauth) below.
A request to anything
else with no credential, or an expired or invalid one, gets:

```
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer resource_metadata="http://localhost:38081/.well-known/oauth-protected-resource"
```

```json
{ "error": "authentication required" }
```

See [Authentication](/openbooks-docs/dev/auth/) for the credential types, the
`/auth/*` routes, the WebAuthn ceremonies, and the OAuth protocol behind the
metadata that challenge header points at.

### `GET /auth/tokens`

Lists the calling user's live connections — one row per thing a human would
call a connection, not per token row (handler `list_tokens`, backed by
`auth::token::list_connections`). A rotating OAuth grant has exactly one live
refresh token at a time, and that row *is* the connection; a token from
`just mint-token` is an access token with no parent and counts the same way.
Readable by a bearer token, the same as `GET /auth/passkeys` — reading the
list is attribution, not a credential operation.

**Response `200`** — array of `Connection`:

```json
[
  {
    "id": "3f9c...b2",
    "client_id": "openbooks-cli",
    "client_name": "openbooks-cli",
    "kind": "access",
    "label": "laptop script",
    "last_used_at": null,
    "expires_at": "2026-09-04T12:00:00Z"
  }
]
```

`id` is the row's SHA-256 `token_hash` — not a credential itself, so it's
safe to show and safe to send back to `DELETE`. `kind` is `access` for a
minted script token or `refresh` for an OAuth grant's live refresh token.

```sh
curl localhost:38081/auth/tokens -H "Authorization: Bearer $OPENBOOKS_TOKEN"
```

### `DELETE /auth/tokens/{id}`

Ends one connection: revokes the named token and everything descended from
it (`auth::token::revoke_one`, via `oauth::token::revoke_family`) — for a
refresh token that takes the access token it most recently minted, too, so
the client stops working immediately rather than for the rest of that hour.

Requires a **full cookie session** — refuses a bearer token with `403`, the
same reasoning as `POST /auth/password` and `DELETE /auth/passkeys/{id}`: a
bearer token is a long-lived machine credential with no second factor behind
it, and letting one disconnect the user's other clients would turn a leak
into a way to cut the real owner off from everything at once.

**Responses:**

- `204 No Content` — revoked
- `403 Forbidden` — called with a bearer token instead of a session
- `404 Not Found` — `{id}` names nothing live belonging to the caller: unknown,
  someone else's, or already revoked/expired. There's no RBAC, but a `404`
  here is not a permission check — it's the same "your tokens are your own"
  fact that scopes every query by the session's `user_id`.

```sh
curl -X DELETE localhost:38081/auth/tokens/3f9c...b2 \
  -H "Cookie: ob_session=..."
```

## Health

### `GET /health`

Returns the plain text `ok` with status `200`. No params, no body, and no
authentication — the one open route.

```sh
curl localhost:38081/health
```

## OAuth

Six routes need no credential at all, and four need a full cookie session.
All ten are implemented in `openbooks-api/src/oauth/`; see
[Authentication](/openbooks-docs/dev/auth/) for the protocol they implement —
PKCE, the loopback rule, refresh rotation — this page is just the wire shape.

`Cache-Control: no-store` is on every error this module raises (`OAuthError`),
and on the success responses that carry a token or a code — both branches of
`POST /oauth/authorize/approve` and `token::no_store`'s responses from
`POST /oauth/token`. It is **not** on every response: `GET /oauth/authorize`'s
303 sets only `Location`, and `GET /oauth/client_info`'s 200 is a bare `Json`
with nothing to protect from a cache.

Most error responses from these six routes use the OAuth error shape,
`{"error", "error_description"}`, which is distinct from the ledger's plain
`{"error"}`:

```json
{ "error": "invalid_grant", "error_description": "that refresh token is not redeemable" }
```

but this shape comes from `OAuthError` specifically, and two other layers can
answer first with something else. An unauthenticated
`POST /oauth/authorize/approve` or `GET /oauth/client_info` never reaches
`OAuthError` at all — the `require_user` middleware in front of the session
tier rejects it first, with the plain `{"error": "authentication required"}`
shape and no `error_description`. And axum's own extractors can reject before
either handler or middleware runs: a missing required query parameter on
`GET /oauth/authorize` is a plain-text `400 Failed to deserialize query
string`, a missing `grant_type` on `POST /oauth/token` is a plain-text `422`,
and a `POST /oauth/token` sent with the wrong `Content-Type` is a plain-text
`415`.

### `GET /.well-known/oauth-protected-resource`

No params, no auth. Returns:

```json
{
  "resource": "http://localhost:38081",
  "authorization_servers": ["http://localhost:38081"],
  "bearer_methods_supported": ["header"]
}
```

### `GET /.well-known/oauth-authorization-server`

No params, no auth. Returns:

```json
{
  "issuer": "http://localhost:38081",
  "authorization_endpoint": "http://localhost:38081/oauth/authorize",
  "token_endpoint": "http://localhost:38081/oauth/token",
  "device_authorization_endpoint": "http://localhost:38081/oauth/device_authorization",
  "registration_endpoint": "http://localhost:38081/oauth/register",
  "revocation_endpoint": "http://localhost:38081/oauth/revoke",
  "response_types_supported": ["code"],
  "grant_types_supported": [
    "authorization_code",
    "refresh_token",
    "urn:ietf:params:oauth:grant-type:device_code"
  ],
  "code_challenge_methods_supported": ["S256"],
  "token_endpoint_auth_methods_supported": ["none"]
}
```

### `POST /oauth/device_authorization`

No auth. **Form-encoded**, not JSON.

**Request body:** `client_id`, `resource` — both required.

**Responses:**

- `200 OK`:
  ```json
  {
    "device_code": "...",
    "user_code": "ABCD-EFGH",
    "verification_uri": "http://localhost:38080/device",
    "verification_uri_complete": "http://localhost:38080/device?user_code=ABCD-EFGH",
    "expires_in": 600,
    "interval": 5
  }
  ```
  `expires_in` is 600 seconds (ten minutes); `interval` is the floor for
  polling `/oauth/token`, five seconds.
- `400 Bad Request` (`invalid_request`) — `resource` not this API
- `401 Unauthorized` (`invalid_client`) — unknown `client_id`
- `500 Internal Server Error` (`server_error`) — could not allocate a unique user code after three tries

```sh
curl -X POST localhost:38081/oauth/device_authorization \
  -d client_id=openbooks-cli -d resource=http://localhost:38081
```

### `POST /oauth/register`

No auth — the only unauthenticated **write** in the system. **JSON**, not
form-encoded.

**Request body:**

```json
{ "redirect_uris": ["http://127.0.0.1/callback"], "client_name": "My tool" }
```

`redirect_uris` is required and non-empty; `client_name` is optional (falls
back to `"an unnamed client"`, and is otherwise stripped of control
characters and capped at 60 characters).

**Responses:**

- `201 Created`:
  ```json
  {
    "client_id": "dyn_...",
    "client_id_issued_at": 1735689600,
    "client_name": "My tool",
    "redirect_uris": ["http://127.0.0.1/callback"],
    "token_endpoint_auth_method": "none",
    "grant_types": ["authorization_code", "refresh_token"],
    "response_types": ["code"]
  }
  ```
  No client secret is ever issued.
- `400 Bad Request` (`invalid_redirect_uri`) — no `redirect_uris`, or one
  that isn't a loopback `http://` URI or a plain `https://` URI (`localhost`,
  a custom scheme, a fragment, or an authority containing `@` all fail this)
- `429 Too Many Requests` (`temporarily_unavailable`) — this server already
  holds its limit of dynamically registered clients (`MAX_DYNAMIC_CLIENTS`,
  20)

```sh
curl -X POST localhost:38081/oauth/register -H 'content-type: application/json' \
  -d '{"redirect_uris": ["http://127.0.0.1/callback"], "client_name": "My tool"}'
```

### `GET /oauth/device_info`

Requires a **full cookie session** — refuses a bearer token, with `403`
(`invalid_client`), the same as `POST /oauth/authorize/approve`.

**Query param:** `user_code` — accepted in any case, with or without the dash.

**Responses:**

- `200 OK`:
  ```json
  { "client": { "id": "openbooks-cli", "name": "openbooks-cli", "dynamic": false, "first_use": true, "redirect_uris": ["http://127.0.0.1/callback"] }, "expires_in": 480 }
  ```
- `400 Bad Request` (`invalid_grant`) — no pending code matches, charges one
  attempt against the session's guessing budget
- `403 Forbidden` (`invalid_client`) — a bearer token was presented instead
  of a session
- `429 Too Many Requests` (`invalid_request`) — this session has spent all
  10 of its guesses (`MAX_DEVICE_ATTEMPTS`) and must sign in again

```sh
curl localhost:38081/oauth/device_info?user_code=ABCD-EFGH -H 'cookie: ...'
```

### `POST /oauth/device/approve`

Requires a **full cookie session** — refuses a bearer token, same shape as
above.

**Request body:** `{ "user_code": "...", "approve": true }`.

**Responses:**

- `204 No Content` — approved or denied; approving also marks the client used
- `400 Bad Request` (`invalid_grant`) — no pending code matches, charges an
  attempt
- `403 Forbidden` (`invalid_client`) — a bearer token was presented
- `429 Too Many Requests` (`invalid_request`) — guessing budget spent

### `GET /oauth/authorize`

No auth (see [Authentication](/openbooks-docs/dev/auth/) for why that's
deliberate).

**Query params:** `client_id`, `redirect_uri`, `response_type` (`code`),
`code_challenge`, `code_challenge_method` (`S256`), `resource`, and an
optional `state`.

**Responses:**

- `303 See Other`, `Location: <WEB_ORIGIN>/authorize?<same query string>` — valid request
- `400 Bad Request` (`invalid_request`) — bad `response_type`, bad PKCE
  shape, unregistered `redirect_uri`, or `resource` not this API
- `401 Unauthorized` (`invalid_client`) — unknown `client_id`

```sh
open 'http://localhost:38081/oauth/authorize?response_type=code&client_id=openbooks-cli&redirect_uri=http%3A%2F%2F127.0.0.1%3A54213%2Fcallback&code_challenge=...&code_challenge_method=S256&resource=http%3A%2F%2Flocalhost%3A38081'
```

### `POST /oauth/token`

No auth — authenticated by the code/verifier or refresh token in the body,
not by a header. **Form-encoded** (`application/x-www-form-urlencoded`), not
JSON.

**Request body**, `grant_type=authorization_code`:

| Field | Required |
|---|---|
| `grant_type` | `authorization_code` |
| `code` | yes |
| `redirect_uri` | yes |
| `client_id` | yes |
| `code_verifier` | yes |
| `resource` | no (checked against this API if present) |

**Request body**, `grant_type=refresh_token`:

| Field | Required |
|---|---|
| `grant_type` | `refresh_token` |
| `refresh_token` | yes |
| `client_id` | yes |
| `resource` | no (checked against this API if present) |

**Request body**, `grant_type=urn:ietf:params:oauth:grant-type:device_code`:

| Field | Required |
|---|---|
| `grant_type` | `urn:ietf:params:oauth:grant-type:device_code` |
| `device_code` | yes |
| `client_id` | yes |
| `resource` | no (checked against this API if present) |

The device branch answers one of four codes rather than the single
`invalid_grant` the other two branches collapse to, because a polling client
has to tell them apart — see
[the device grant](/openbooks-docs/dev/auth/#the-device-grant-rfc-8628):

| Code | Status | When |
|---|---|---|
| `authorization_pending` | 400 | nobody has approved or denied it yet |
| `slow_down` | 400 | polling faster than the interval |
| `access_denied` | 400 | the human declined it — terminal |
| `expired_token` | 400 | the ten minutes ran out — terminal |
| `invalid_grant` | 400 | unknown `device_code`, wrong `client_id`, or already claimed |

**Responses:**

- `200 OK`:
  ```json
  { "access_token": "ob_...", "token_type": "Bearer", "expires_in": 3600, "refresh_token": "ob_..." }
  ```
  Access tokens last 1 hour, refresh tokens 60 days.
- `400 Bad Request` (`invalid_request`, `invalid_grant`,
  `unsupported_grant_type`, or one of the device-grant codes above) — see the
  error table in [Authentication](/openbooks-docs/dev/auth/)
- `500 Internal Server Error` (`server_error`)

```sh
curl -X POST localhost:38081/oauth/token \
  -d grant_type=authorization_code -d code=... -d client_id=openbooks-cli \
  -d redirect_uri=http://127.0.0.1:54213/callback -d code_verifier=... \
  -d resource=http://localhost:38081
```

### `POST /oauth/revoke`

RFC 7009. No auth — presenting the token *is* the authentication, the same as
`POST /oauth/token`. **Form-encoded**, not JSON.

**Request body:**

| Field | Required |
|---|---|
| `token` | yes |
| `token_type_hint` | no (accepted and ignored — the hash finds the row whichever kind it is) |
| `client_id` | no (scopes the revocation to that client; a mismatch revokes nothing but still answers `200`) |

Revoking a refresh token also revokes the access tokens it minted (RFC 7009's
"descendants"). Revoking an access token leaves its refresh token alone.

**Responses:**

- `200 OK`, empty body, `Cache-Control: no-store` — success, and also an
  unknown, expired, or already-revoked token (RFC 7009 §2.2: the caller asked
  for it to be invalid, and it is — answering `404` would make this an oracle
  for guessing token values)

```sh
curl -X POST localhost:38081/oauth/revoke -d token=ob_...
```

### `POST /oauth/authorize/approve`

Requires a **full cookie session** — the only OAuth route that refuses a
bearer token, with `403` (not `401`):

```json
{ "error": "invalid_client", "error_description": "approve a client from the web app, not with a token" }
```

**Request body** — every `GET /oauth/authorize` query param, plus `approve`:

```json
{ "client_id": "...", "redirect_uri": "...", "response_type": "code",
  "code_challenge": "...", "code_challenge_method": "S256",
  "resource": "...", "state": "...", "approve": true }
```

**Responses:**

- `200 OK`, `approve: true` — `{ "redirect": "<redirect_uri>?code=...&state=..." }`
- `200 OK`, `approve: false` — `{ "redirect": "<redirect_uri>?error=access_denied&state=..." }`
- `400`/`401` — same validation as `GET /oauth/authorize`

Note this is a `200` carrying a redirect target in the body, not an HTTP
redirect — the target is a loopback listener on the user's own machine.

### `GET /oauth/client_info`

Requires the full tier — a bearer token is accepted here, unlike `approve`.

**Query param:** `client_id`.

**Response `200`:**

```json
{ "id": "openbooks-cli", "name": "openbooks-cli", "dynamic": false, "first_use": true, "redirect_uris": ["http://127.0.0.1/callback"] }
```

`redirect_uris` is the registered host where an approved grant would send the authorization code — the consent surface renders this so the approver can verify the destination.

**Response `401`** (`invalid_client`) — unknown `client_id`.

## Accounts

### `GET /accounts`

Lists every account, ordered by kind then name (handler `list_accounts`, backed
by `accounts_data`).

No query params.

**Response `200`** — array of `Account`:

```json
[
  { "id": 1, "name": "Checking Account", "kind": "asset" },
  { "id": 10, "name": "Opening Balance", "kind": "equity" }
]
```

`kind` is one of `asset`, `liability`, `equity`, `income`, `expense`
(lowercase — the `AccountType` enum serializes with `rename_all = "lowercase"`).

```sh
curl localhost:38081/accounts
```

### `POST /accounts`

Creates an account (handler `create_account`).

**Request body** (`NewAccount`):

```json
{ "name": "Savings Account", "kind": "asset" }
```

`name` is required and trimmed; a blank name (after trim) returns `400` with
`{"error": "name is required"}`. `kind` must be a valid `account_type` string.

**Responses:**

- `201 Created` — the created `Account`, e.g. `{ "id": 11, "name": "Savings Account", "kind": "asset" }`
- `400 Bad Request` — blank name, or a database constraint violation (for
  example a duplicate `name`, which is `unique`)

```sh
curl -X POST localhost:38081/accounts -H 'content-type: application/json' \
  -d '{"name": "Savings Account", "kind": "asset"}'
```

## Settings

Instance-wide presentation settings. These describe the books rather than the
visitor, so every client — web, desktop, terminal — reads the same answer, and
changing one changes it for everybody. Nothing here affects the ledger.

### `GET /settings`

Returns the single settings row (handler `get_settings`, backed by `settings_data`).

**Response `200`** — `Settings`:

```json
{ "book_style": "club" }
```

`book_style` is `club` or `personal`. It selects the vocabulary a client presents
with — a club reads "Treasurer's report" and "What we owe", a household reads "Where
the money went" and "What you owe". It changes no figure, no validation, and no
stored ledger data, so it is safe to change back at any time.

```sh
curl localhost:38081/settings
```

### `PUT /settings`

Updates it (handler `update_settings`). No `where` clause is needed — the table is
constrained to a single row.

**Request body** (`SettingsPatch`):

```json
{ "book_style": "personal" }
```

**Responses:**

- `200 OK` — the updated `Settings`
- `422 Unprocessable Entity` — any other value for `book_style`, rejected while
  deserializing before it reaches the database

```sh
curl -X PUT localhost:38081/settings -H 'content-type: application/json' \
  -d '{"book_style": "personal"}'
```

## Transactions

### `GET /transactions`

Lists transactions with their entries nested inside, newest first (handler
`list_transactions`, backed by `transactions_data`).

**Query params** (`DateRange`, both optional):

| Param | Type | Meaning |
|---|---|---|
| `from` | date (`YYYY-MM-DD`) | only transactions on or after this date |
| `to` | date (`YYYY-MM-DD`) | only transactions on or before this date |

**Response `200`** — array of `Transaction`, ordered by `occurred_on desc, id desc`,
with each transaction's `entries` ordered by entry id:

```json
[
  {
    "id": 42,
    "occurred_on": "2026-03-05",
    "description": "Meeting pizza",
    "created_by_email": "poster@example.com",
    "entries": [
      { "account_id": 7, "account_name": "Food", "amount_cents": 4500 },
      { "account_id": 1, "account_name": "Checking Account", "amount_cents": -4500 }
    ]
  }
]
```

`created_by_email` is the authenticated caller who posted the transaction,
resolved from `transactions.created_by` — null for anything posted before
phase 5, or if the author has since been deleted. Seeded transactions all
have one.

```sh
curl 'localhost:38081/transactions?from=2026-01-01&to=2026-03-31'
```

### `POST /transactions`

Records a balanced transaction (handler `create_transaction`, backed by
`create_transaction_data`). Insert happens inside a database transaction: the
header row and all entry rows commit together, and the deferred constraint
trigger checks the balance at commit — see
[Data model](/openbooks-docs/dev/data-model/#the-balance-invariant-is-a-postgres-trigger-not-app-code).

**Request body** (`NewTransaction`):

```json
{
  "occurred_on": "2026-03-05",
  "description": "Meeting pizza",
  "entries": [
    { "account_id": 7, "amount_cents": 4500 },
    { "account_id": 1, "amount_cents": -4500 }
  ]
}
```

| Field | Type | Notes |
|---|---|---|
| `occurred_on` | date | required |
| `description` | string | required, trimmed, must be non-empty |
| `entries` | array of `{account_id: number, amount_cents: number}` | at least 2 entries, must sum to 0 |

**Responses:**

- `201 Created` — `{ "id": 42 }`
- `400 Bad Request` — blank description; fewer than 2 entries; entries that
  don't sum to zero (message includes the count and the actual sum, e.g.
  `"needs 2+ entries summing to zero (got 1 entries summing to 4500)"`); or a
  database-level rejection such as an unknown `account_id` or the balance
  trigger firing

```sh
curl -X POST localhost:38081/transactions -H 'content-type: application/json' -d '{
  "occurred_on": "2026-03-05",
  "description": "Meeting pizza",
  "entries": [
    {"account_id": 7, "amount_cents":  4500},
    {"account_id": 1, "amount_cents": -4500}
  ]
}'
```

### `DELETE /transactions/{id}`

Deletes a transaction and, via `on delete cascade`, its entries (handler
`delete_transaction`).

**Path param:** `id` — integer transaction id.

**Responses:**

- `204 No Content` — deleted
- `404 Not Found` — `{ "error": "no such transaction" }` if no row matched

```sh
curl -X DELETE localhost:38081/transactions/42
```

:::note
There is no `PATCH`/`PUT` for transactions. To fix a mistake, delete it and
post a new one.
:::
