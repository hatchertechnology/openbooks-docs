---
title: Postgres
description: The compose file, the credentials it ships with, and what the four migrations create.
sidebar:
  order: 2
---

OpenBooks keeps every fact in Postgres and nowhere else — no cache, no
secondary store to fall out of sync. `openbooks-api/compose.yaml` defines the
one service that runs it.

## The container

```yaml
services:
  postgres:
    image: postgres:18-alpine
    environment:
      POSTGRES_USER: openbooks
      POSTGRES_PASSWORD: openbooks
      POSTGRES_DB: openbooks
    ports:
      - "38083:5432"
    volumes:
      - pgdata:/var/lib/postgresql
```

- **Image**: `postgres:18-alpine`.
- **Credentials**: user `openbooks`, password `openbooks`, database
  `openbooks` — set by the compose file itself, not generated. Change them by
  editing `compose.yaml` and pointing `DATABASE_URL` (see
  [Configuration](/openbooks-docs/server/configuration/)) at whatever you set.
- **Ports**: container port 5432, published on host port **38083**. The
  comment in the compose file explains the choice: 5433 is "everybody's
  second postgres" once you run more than one project, so 38083 pairs with the
  API's 38081 instead of colliding with someone else's stack.
- **Volume**: a single named volume, `pgdata`, mounted at
  `/var/lib/postgresql` — not just the `.../data` subdirectory, because
  Postgres 18 wants the parent directory. `just reset` and `just reset-clean`
  delete this volume, which means every recorded transaction; both prompt
  before doing it.
- **Health check**: `pg_isready -U openbooks` on a 5 second interval, up to 10
  retries. `just run` waits for this to report healthy before it builds and
  starts the API, so migrations never race a database that isn't accepting
  connections yet.

## Migrations run automatically

The API runs `sqlx::migrate!()` against `DATABASE_URL` on every startup
(`openbooks-api/src/main.rs`), before it binds a port or accepts a request.
There's no separate migrate command — starting the API *is* the migration
step. The four migrations live in `openbooks-api/migrations/`.

### `0001_init.sql` — the ledger

Creates the `account_type` enum (`asset`, `liability`, `equity`, `income`,
`expense`) and three tables: `accounts`, `transactions`, and `entries`. Entries
carry signed `amount_cents` — debit positive, credit negative — with a
`check (amount_cents <> 0)` so a zero-amount leg can't exist at all.

The balance invariant lives here, not in application code: a deferred
constraint trigger, `entries_balanced`, fires after any insert, update, or
delete on `entries` and raises an exception if the entries for a transaction
don't sum to zero. It's deferred to the end of the transaction because entries
are inserted one row at a time.

### `0002_seed_accounts.sql` — a starter chart of accounts

Inserts ten accounts a family or club can use as-is: `Checking Account` and
`Cash Box` (asset), `Dues`, `Donations`, `Fundraising` (income), `Supplies`,
`Food`, `Rent`, `Fees` (expense), and `Opening Balance` (equity). These exist
in every database from the first migration onward — `just seed` adds
transactions against them, plus a couple of accounts of its own (see
[Sample data](/openbooks-docs/server/sample-data/)), but doesn't create this
starter set.

### `0003_settings.sql` — instance-wide presentation

A single-row `settings` table holding `book_style`, either `club` or
`personal`. The single-row shape is enforced by a boolean primary key with
`check (id)` — the only value that satisfies both the check and the primary
key's uniqueness is `true`, so a second row can never exist to disagree with
the first. This setting belongs to the books, not to a browser, so every
client reads the same answer; it only changes wording, never anything about
the ledger itself.

### `0004_auth.sql` — authentication

Creates eight tables in one migration, even though only four are written to in
the current phase: `users`, `webauthn_credentials`, `webauthn_challenges`,
`sessions`, `oauth_clients`, `oauth_codes`, `oauth_device_codes`, and
`oauth_tokens`. It also adds a nullable `created_by` column to `transactions`,
for attribution rather than authorization — nothing reads it to make a
decision.

Notable design choices visible in the schema:

- `users.email` is stored lowercased by the application, not by a Postgres
  `citext` column — one less extension the database has to have installed.
- `sessions.id` is the SHA-256 of the cookie value, never the raw value, so a
  database dump doesn't yield a usable session.
- `oauth_clients` ships two pre-registered rows, `openbooks-cli` and
  `openbooks-desktop`, so those first-party clients never touch dynamic client
  registration.
- `oauth_tokens.parent_hash` chains a rotated refresh token to the one it
  replaced, so reusing a retired token can revoke the whole family.

See [Authentication](/openbooks-docs/dev/auth/) for how these tables get used
at request time, and
[Users and tokens](/openbooks-docs/server/users-and-tokens/) for the admin
commands that populate `users` and `oauth_tokens`.
