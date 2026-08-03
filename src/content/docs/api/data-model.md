---
title: Data model
description: Accounts, transactions, and entries — the three tables behind the ledger, and the invariant that keeps them honest.
sidebar:
  order: 2
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

## Money is integer cents

`amount_cents` is a `bigint`. There are no floating-point amounts anywhere in
the money path — `$45.00` is stored and moved around as `4500`. The `NewEntry`
and `Entry` structs in `openbooks-api/src/main.rs` use `i64` for the same
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
`create_transaction_data` (`openbooks-api/src/main.rs`) — rejecting fewer than
two entries or a nonzero sum before it even opens a transaction — exists only
to return a friendlier `400` message. If the API check ever had a bug, the
trigger still stops crooked data from landing. Don't move this invariant into
application code; keep it in the database.
:::

## Indexes

`0001_init.sql` adds two indexes to support the common lookups: `entries` by
`transaction_id` (used when assembling a transaction's legs) and by
`account_id` (used when computing an account's balance).
