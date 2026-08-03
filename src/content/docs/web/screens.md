---
title: Screens
description: A walkthrough of every route in openbooks-web, what a user does there, and which API calls it makes.
sidebar:
  order: 2
---

Four routes, defined by the files in `openbooks-web/app/pages/`. The nav bar in
`openbooks-web/app/app.vue` links to all four under plain-English labels.

## Dashboard (`/`)

File: `openbooks-web/app/pages/index.vue`.

This is the screen a treasurer lives on. It has three sections:

1. **Money on hand** — a single total, summed from every asset ("where money sits")
   account's balance. Income and expense balances are deliberately excluded from
   this number; they're lifetime totals, not cash you hold.
2. **Record something** — three tabs, "Money in", "Money out", and "Transfer". Each
   tab reconfigures the same form: which dropdown means "the bank/cash account" and
   which means "the category", and what the category dropdown is populated with
   (income accounts for money in, expense accounts for money out, other asset
   accounts for a transfer). See [Recording money](/openbooks-docs/web/recording-money/) for the
   field-by-field detail.
3. **Every account** — a flat table of every account's current balance, including
   income and expense accounts, with a note clarifying that those two are
   since-day-one totals rather than money on hand.

API calls on load: `GET /accounts` and `GET /reports/balances` (via
`api.accounts()` and `api.balances()`). Submitting the form calls
`POST /transactions` (`api.createTransaction()`), then refreshes both.

## History (`/transactions`)

File: `openbooks-web/app/pages/transactions.vue`.

Lists every recorded transaction, newest first, with optional `From`/`To` date
filters (native `<input type="date">`). Each row shows the date, description, a
"where it moved" summary built client-side as `"<destination> ← <source>"` from the
transaction's entries, and the amount. A `Delete` link on each row asks for
confirmation, then removes it.

API calls: `GET /transactions` with optional `from`/`to` query params
(`api.transactions()`), re-run whenever the date filters change. Delete calls
`DELETE /transactions/:id` (`api.deleteTransaction()`) and refetches the list.

## Reports (`/reports`)

File: `openbooks-web/app/pages/reports.vue`.

Lets the user pick Monthly, Quarterly, or Annual, plus the specific month/quarter
and year, and renders two statements for that period: an income-and-expense
statement and a snapshot balance sheet. A `Print` button triggers the browser print
dialog; `openbooks-web/app/app.vue` has print-specific CSS that hides navigation and
controls (`.no-print`) so the printed page is just the statements. See
[Reports](/openbooks-docs/web/reports/) for what each table shows.

API calls: `GET /reports/income-statement` with `from`/`to` (`api.incomeStatement()`)
and `GET /reports/balance-sheet` with `as_of` set to the period's end date
(`api.balanceSheet()`). Both re-run whenever the period selection changes.

## Categories (`/accounts`)

File: `openbooks-web/app/pages/accounts.vue`.

Where accounts get created and reviewed. A form adds a new one with a plain-English
name and a "what kind" dropdown (labelled "Where money sits", "Where money comes
from", "What money is spent on", "What we owe", "Starting balances" — see
[Overview](/openbooks-docs/web/overview/) for why). Below the form, one card per kind lists the
accounts that already exist in that kind, or "None yet" if there aren't any.

API calls: `GET /accounts` on load (`api.accounts()`); submitting the form calls
`POST /accounts` (`api.createAccount()`) and refetches.
