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
or a bearer token — only `GET /health` is open. A request with neither, or
with an expired or invalid one, gets:

```
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer resource_metadata="http://localhost:38081/.well-known/oauth-protected-resource"
```

```json
{ "error": "authentication required" }
```

See [Authentication](/openbooks-docs/dev/auth/) for the credential types, the
`/auth/*` routes themselves, and what that challenge header does and doesn't
mean in phase 1.

## Health

### `GET /health`

Returns the plain text `ok` with status `200`. No params, no body, and no
authentication — the one open route.

```sh
curl localhost:38081/health
```

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
