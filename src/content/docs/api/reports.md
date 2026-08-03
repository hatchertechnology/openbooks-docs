---
title: Reports
description: The balances, income statement, and balance sheet endpoints, and the sign-flipping rule that makes them readable.
sidebar:
  order: 4
---

Three reporting endpoints, all in `openbooks-api/src/main.rs`, all built on one
shared query: `balances()`. That function sums `amount_cents` per account over
an optional date window, then flips the sign per account kind before anything
else touches the numbers.

## The sign-flipping rule

Raw ledger entries are signed for accounting convenience — debit positive,
credit negative — not for readability. `AccountType::sign()` is the single
place that turns a raw sum into the number a non-accountant expects to see:

```rust
/// Assets and expenses grow with debits (+); everything else grows with
/// credits (-). Flipping the sign turns a raw ledger sum into the positive
/// number a non-accountant expects to read on a statement.
fn sign(self) -> i64 {
    match self {
        AccountType::Asset | AccountType::Expense => 1,
        _ => -1,
    }
}
```

Concretely: asset and expense balances are shown as-is. Liability, equity, and
income balances get multiplied by `-1`. That's why, for example, income
(which is credited, so its raw sum is negative) comes back as a positive
number in the income statement.

Every reporting endpoint returns numbers *after* this flip has already
happened. If you're consuming the API, don't flip signs again — the MCP
server's `initialize` response says the same thing to a calling model:

> Reports return positive numbers — the sign flipping is already done, so
> present them as given.

## `GET /reports/balances`

The balance of every account over an optional window — "how much money do we
have?" (handler `balances_report`, backed by `account_balances_data`).

**Query params** (`DateRange`, both optional): `from`, `to` — `YYYY-MM-DD`.

If both are omitted, this is the all-time, current balance of every account.
Accounts with no activity in the window still appear, at `0` — the query uses
a `FILTER` clause rather than a `WHERE` so it doesn't drop accounts that
merely have no matching entries.

**Response `200`** — array of `Line`:

```json
[
  { "account": "Checking Account", "cents": 128450 },
  { "account": "Dues", "cents": 36000 },
  { "account": "Food", "cents": 9800 }
]
```

```sh
curl 'localhost:38081/reports/balances?from=2026-01-01&to=2026-03-31'
```

## `GET /reports/income-statement`

Money in, money out, and the net for a period — described in the code as "the
meeting report" (handler `income_statement`, backed by
`income_statement_data`).

**Query params** (`DateRange`, both optional): `from`, `to`.

**Response `200`** — `IncomeStatement`:

```json
{
  "from": "2026-01-01",
  "to": "2026-03-31",
  "income": [
    { "account": "Dues", "cents": 36000 },
    { "account": "Fundraising", "cents": 12000 }
  ],
  "total_income_cents": 48000,
  "expenses": [
    { "account": "Food", "cents": 9800 },
    { "account": "Rent", "cents": 15000 }
  ],
  "total_expenses_cents": 24800,
  "net_cents": 23200
}
```

`net_cents` is `total_income_cents - total_expenses_cents`.

```sh
curl 'localhost:38081/reports/income-statement?from=2026-01-01&to=2026-03-31'
```

## `GET /reports/balance-sheet`

What the club holds, what it owes, and the difference, as of one date (handler
`balance_sheet`, backed by `balance_sheet_data`).

**Query params** (`AsOf`, optional): `as_of` — `YYYY-MM-DD`. Balances are
computed with `from = None`, so this is always all-time activity up to
`as_of`, never a windowed slice.

**Response `200`** — `BalanceSheet`:

```json
{
  "as_of": "2026-03-31",
  "assets": [
    { "account": "Cash Box", "cents": 5000 },
    { "account": "Checking Account", "cents": 128450 }
  ],
  "total_assets_cents": 133450,
  "liabilities": [
    { "account": "Fees", "cents": 0 }
  ],
  "total_liabilities_cents": 0,
  "equity": [
    { "account": "Opening Balance", "cents": 100000 }
  ],
  "retained_cents": 33450,
  "total_equity_cents": 133450
}
```

`retained_cents` is all-time income minus all-time expenses. It's added in
because this POC never closes a period's profit into an equity account —
without it, the sheet wouldn't balance. `total_equity_cents` is the sum of the
equity account balances plus `retained_cents`, and by construction
`total_assets_cents == total_liabilities_cents + total_equity_cents`.

```sh
curl 'localhost:38081/reports/balance-sheet?as_of=2026-03-31'
```

:::note
`just smoke` (`openbooks-api/smoke.sh`) asserts real numbers from these three
endpoints, including that the balance sheet actually balances. Run it after
touching the ledger or the reporting endpoints.
:::
