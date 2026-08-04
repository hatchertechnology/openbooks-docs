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
`POST /auth/login`/`logout`, the two `.well-known` documents, and
`GET /oauth/authorize`/`POST /oauth/token` — see [OAuth](#oauth) below. A
request to anything else with no credential, or an expired or invalid one,
gets:

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

## Health

### `GET /health`

Returns the plain text `ok` with status `200`. No params, no body, and no
authentication — the one open route.

```sh
curl localhost:38081/health
```

## OAuth

Four routes need no credential at all, and two need a full cookie session.
All six are implemented in `openbooks-api/src/oauth/`; see
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
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code", "refresh_token"],
  "code_challenge_methods_supported": ["S256"],
  "token_endpoint_auth_methods_supported": ["none"]
}
```

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

**Responses:**

- `200 OK`:
  ```json
  { "access_token": "ob_...", "token_type": "Bearer", "expires_in": 3600, "refresh_token": "ob_..." }
  ```
  Access tokens last 1 hour, refresh tokens 60 days.
- `400 Bad Request` (`invalid_request`, `invalid_grant`, or
  `unsupported_grant_type`) — see the error table in
  [Authentication](/openbooks-docs/dev/auth/)
- `500 Internal Server Error` (`server_error`)

```sh
curl -X POST localhost:38081/oauth/token \
  -d grant_type=authorization_code -d code=... -d client_id=openbooks-cli \
  -d redirect_uri=http://127.0.0.1:54213/callback -d code_verifier=... \
  -d resource=http://localhost:38081
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
{ "id": "openbooks-cli", "name": "openbooks-cli", "dynamic": false, "first_use": true }
```

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
    "entries": [
      { "account_id": 7, "account_name": "Food", "amount_cents": 4500 },
      { "account_id": 1, "account_name": "Checking Account", "amount_cents": -4500 }
    ]
  }
]
```

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
