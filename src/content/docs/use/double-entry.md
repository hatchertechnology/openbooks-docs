---
title: Double-entry bookkeeping
description: What double-entry means, and how OpenBooks models accounts, transactions, and signed entries.
sidebar:
  order: 8
---

You don't need an accounting background to use OpenBooks, but the ledger
underneath is a real double-entry system. This page explains what that means
and how the code represents it.

## The idea, without the jargon

Every time money moves, it moves *from* somewhere *to* somewhere. Pay $45 for
supplies out of the checking account, and $45 leaves checking and $45 lands in
"supplies expense." Collect $20 in dues, and $20 leaves the "dues income"
bucket and lands in checking.

Double-entry bookkeeping just means you always write down both sides of that
move, not only the one that feels like "the transaction." Every event becomes
two (or more) entries that cancel out. That habit is what makes the books
self-checking: if the two sides of every entry always cancel, the whole ledger
always adds up to zero, and a mistake shows up as a ledger that doesn't
balance instead of silently vanishing.

The reward for writing both sides down is that you get real financial
statements for free: how much cash you have on hand, how much you took in and
spent this quarter, and whether that matches what changed in your bank
account. That's what falls out of the ledger described in
[Invariants](/openbooks-docs/dev/invariants/) and the reports on
[account balances, income statement, and balance sheet](/openbooks-docs/dev/reports/).

## Accounts and their types

An account is a bucket money can sit in or flow through — a bank account, a
category of spending, a source of income. Every account in OpenBooks has
exactly one of five types, defined as a Postgres enum in
`openbooks-api/migrations/0001_init.sql`:

```sql
create type account_type as enum ('asset', 'liability', 'equity', 'income', 'expense');
```

| Type | What it represents | Example from the starter chart of accounts |
|---|---|---|
| `asset` | Something you hold | Checking Account, Cash Box |
| `liability` | Something you owe | (added as needed — e.g. an unpaid invoice) |
| `equity` | Net worth, opening balances, retained earnings | Opening Balance |
| `income` | Money coming in | Dues, Donations, Fundraising |
| `expense` | Money going out | Supplies, Food, Rent, Fees |

`openbooks-api/migrations/0002_seed_accounts.sql` creates a starter set of
these so a fresh install has something to record against immediately.

## Transactions and entries

A **transaction** is a dated, described event — "March dues collected,"
"Meeting pizza." It carries no money by itself. The money lives on its
**entries**: each entry is one leg of the transaction, pointing at one
account with one signed amount.

From `openbooks-api/migrations/0001_init.sql`:

```sql
create table transactions (
    id          bigserial primary key,
    occurred_on date not null,
    description text not null,
    created_at  timestamptz not null default now()
);

create table entries (
    id             bigserial primary key,
    transaction_id bigint not null references transactions (id) on delete cascade,
    account_id     bigint not null references accounts (id),
    amount_cents   bigint not null check (amount_cents <> 0)
);
```

A transaction needs at least two entries — one isn't enough to represent
"money moved from A to B."

## Signed entries: debit positive, credit negative

There's no separate column recording whether an entry is a "debit" or a
"credit." The sign of `amount_cents` carries that information directly:

- Post a **positive** amount to **debit** an account.
- Post a **negative** amount to **credit** an account.

That's the entire vocabulary. Whether a debit makes an account's balance go
up or down depends on the account's type — see
[`AccountType::sign()`](/openbooks-docs/dev/invariants/#report-sign-flipping-accounttypesign) —
but the entry itself only ever stores a signed number of cents.

## Why entries must sum to zero

A transaction is **balanced** when the `amount_cents` values of all its
entries add up to exactly `0`. That's the double-entry rule stated as
arithmetic: whatever leaves one account must land, in full, somewhere else.

OpenBooks enforces this as a real database constraint, not just an API
convention — see [Invariants](/openbooks-docs/dev/invariants/) for exactly where. If you
try to record entries that don't sum to zero, the write fails.

## Worked example

Three everyday transactions, shown as the actual entries OpenBooks would
store. Amounts are cents, per [Money](/openbooks-docs/dev/money/).

### Dues received

$20 in membership dues arrives and goes into the checking account. Checking
is an `asset`, Dues is `income`. The asset gets debited (money arrived) and
the income account gets credited:

| Account | Type | `amount_cents` |
|---|---|---|
| Checking Account | asset | `+2000` |
| Dues | income | `-2000` |

Sum: `2000 + (-2000) = 0`. Balanced.

### A supplies expense

$45 is spent on supplies out of checking. The expense account is debited
(it's growing) and the asset is credited (money left it):

| Account | Type | `amount_cents` |
|---|---|---|
| Supplies | expense | `+4500` |
| Checking Account | asset | `-4500` |

Sum: `4500 + (-4500) = 0`. Balanced.

### A transfer

$100 moves from the checking account into the cash box, so the club has
petty cash for a bake sale. Both legs touch asset accounts — one goes up, one
goes down:

| Account | Type | `amount_cents` |
|---|---|---|
| Cash Box | asset | `+10000` |
| Checking Account | asset | `-10000` |

Sum: `10000 + (-10000) = 0`. Balanced.

None of this vocabulary — debit, credit, entry — ever reaches the person
using the web app, the CLI, or the desktop client. They pick an amount, an
account, and a category; the client composes the two-legged transaction shown
above. See [No accounting vocabulary in the UI](/openbooks-docs/dev/invariants/#no-accounting-vocabulary-in-the-ui).
