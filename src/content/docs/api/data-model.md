---
title: Data model
description: Accounts, transactions, and entries — the three tables behind the ledger, and the invariant that keeps them honest.
sidebar:
  order: 3
---

The ledger is three tables, defined in `openbooks-api/migrations/0001_init.sql`.

## `accounts`

```sql
create type account_type as enum ('asset', 'liability', 'equity', 'income', 'expense');

create table accounts (
    id         bigserial primary key,
    name       text not null unique,
    kind       account_type not null,
    created_at timestamptz not null default now()
);
```

Every account has one of five kinds. The kind decides how balances read on a
report — see [Reports](/openbooks-docs/api/reports/) for the sign-flipping rule.

`openbooks-api/migrations/0002_seed_accounts.sql` seeds a starter chart of
accounts: Checking Account and Cash Box (asset), Dues, Donations, and
Fundraising (income), Supplies, Food, Rent, and Fees (expense), and Opening
Balance (equity). You can add more with `POST /accounts`.

## `transactions`

```sql
create table transactions (
    id          bigserial primary key,
    occurred_on date not null,
    description text not null,
    created_at  timestamptz not null default now()
);
```

A transaction is a dated, described event — "Meeting pizza," "March dues
collected." It doesn't hold any money by itself; the amounts live on its
entries.

## `entries`

```sql
create table entries (
    id             bigserial primary key,
    transaction_id bigint not null references transactions (id) on delete cascade,
    account_id     bigint not null references accounts (id),
    amount_cents   bigint not null check (amount_cents <> 0)
);
```

Each entry is one leg of a transaction: an account and a signed amount.
Deleting a transaction cascades to its entries.

## `settings`

One row, holding instance-wide presentation settings. Created by
`migrations/0003_settings.sql`.

| Column | Type | Notes |
|---|---|---|
| `id` | `boolean` | primary key, `default true` |
| `book_style` | `text` | `not null`, `default 'club'` |

Two check constraints do the work:

```sql
constraint settings_is_single_row check (id),
constraint settings_book_style_known check (book_style in ('club', 'personal'))
```

The boolean primary key with `check (id)` is the standard single-row trick: the only
value satisfying both the check and uniqueness is `true`, so the table can never hold
a second row to disagree with. Valid values live in the constraint rather than in app
code, for the same reason the balance rule does — the database is the part that cannot
be bypassed.

`book_style` is presentation only. It selects which vocabulary a client renders and
touches nothing about the ledger, so flipping it is always safe and always reversible.

## Authentication tables

`openbooks-api/migrations/0004_auth.sql` adds eight tables and one column, all
in one migration even though phase 1 only writes four of the tables — a
single auth migration beats one per phase.

| Table | Written in phase 1? | Purpose |
|---|---|---|
| `users` | yes | email (stored lowercased by the app, not `citext`), argon2 `password_hash`, `failed_count` and `retry_after` for login backoff |
| `sessions` | yes | `id` is the **SHA-256 digest** of the session cookie value, never the raw value, so a database dump yields no usable session; `mfa_complete`, `expires_at` (fixed at creation, not sliding), `last_seen_at` |
| `oauth_clients` | yes (seeded rows only) | pre-registered first-party clients — `openbooks-cli` and `openbooks-desktop` — inserted by the migration itself |
| `oauth_tokens` | yes | bearer tokens; `token_hash` is the digest, never the raw token; `kind` is `access` or `refresh` (only `access` is minted in phase 1); `resource` is the token's audience; `revoked_at` |
| `webauthn_credentials` | no | one row per passkey; unused until phase 2 |
| `webauthn_challenges` | no | in-flight WebAuthn ceremony state; unused until phase 2 |
| `oauth_codes` | no | authorization codes for the OAuth code grant; unused until phase 4 |
| `oauth_device_codes` | no | device-flow codes; unused until phase 4 |

Like `sessions.id` and `oauth_tokens.token_hash`, every credential value this
schema stores is a digest, not the secret itself — the raw session cookie
value and the raw bearer token exist only in the response that issues them
and in the client that holds them, never in the database.

`transactions` also gains a nullable `created_by uuid references users(id)`.
It's attribution, not authorization, and **nothing writes it in phase 1** —
existing and seeded transactions predate users, and populating it needs a
`CurrentUser` threaded into the transaction handler, which is a phase 5
tidy-up.

See [Authentication](/openbooks-docs/api/auth/) for what actually happens
with `users`, `sessions`, and `oauth_tokens` — login, backoff, sessions
expiring on a fixed horizon, and tokens being revoked wholesale on a password
change.

## Money is integer cents

`amount_cents` is a `bigint`. There are no floating-point amounts anywhere in
the money path — `$45.00` is stored and moved around as `4500`. The `NewEntry`
and `Entry` structs in `openbooks-api/src/lib.rs` use `i64` for the same
field, so this holds all the way from Postgres to the JSON the API returns.

## Signed entries: debit positive, credit negative

There's no separate "debit or credit" column. The sign of `amount_cents` carries
that information:

- **Debit** an account by posting a **positive** amount.
- **Credit** an account by posting a **negative** amount.

A transaction is balanced when its entries sum to zero. Paying $45 for pizza
from checking is one entry of `+4500` against the Food expense account and one
entry of `-4500` against Checking Account.

## The balance invariant is a Postgres trigger, not app code

The rule that entries must sum to zero per transaction is enforced by a
**deferred constraint trigger** in `0001_init.sql`, not by application logic:

```sql
create function assert_balanced() returns trigger as $$
declare
    txn   bigint := coalesce(new.transaction_id, old.transaction_id);
    total bigint;
begin
    select coalesce(sum(amount_cents), 0) into total from entries where transaction_id = txn;
    if total <> 0 then
        raise exception 'unbalanced transaction %: entries sum to % cents, must be 0', txn, total;
    end if;
    return null;
end $$ language plpgsql;

create constraint trigger entries_balanced
    after insert or update or delete on entries
    deferrable initially deferred
    for each row execute function assert_balanced();
```

It's `deferrable initially deferred` because entries for one transaction are
inserted one row at a time — the check only makes sense once every leg for
that transaction has landed, at commit time.

:::caution
This trigger is the real gate. The API's own pre-check in
`create_transaction_data` (`openbooks-api/src/lib.rs`) — rejecting fewer than
two entries or a nonzero sum before it even opens a transaction — exists only
to return a friendlier `400` message. If the API check ever had a bug, the
trigger still stops crooked data from landing. Don't move this invariant into
application code; keep it in the database.
:::

## Indexes

`0001_init.sql` adds two indexes to support the common lookups: `entries` by
`transaction_id` (used when assembling a transaction's legs) and by
`account_id` (used when computing an account's balance).
