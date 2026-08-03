---
title: Reports
description: What the report screen shows and how the period controls work.
sidebar:
  order: 4
---

The Reports screen (`/reports`, `openbooks-web/app/pages/reports.vue`) is built to
be printed or saved as a PDF and handed out at a meeting. `openbooks-web/app/app.vue`
carries `@media print` styles that hide navigation and controls (anything marked
`.no-print`) so a printout shows only the statements.

## Choosing a period

Three tabs: **Monthly**, **Quarterly**, **Annual**. Depending on which is selected,
a second control appears:

- Monthly shows a month dropdown (named, not numbered).
- Quarterly shows Q1-Q4.
- Annual shows nothing extra.

A year dropdown is always present, covering the current year back five years. The
selected period is converted into a `from`/`to` date range client-side:

\`\`\`ts
/** First and last day of the chosen period. Day 0 of month m+1 is the last of m. */
const range = computed(() => {
  const y = year.value
  if (period.value === 'year') return { from: iso(y, 1, 1), to: iso(y, 12, 31) }
  if (period.value === 'month') {
    return { from: iso(y, month.value, 1), to: iso(y, month.value + 1, 0) }
  }
  const start = (quarter.value - 1) * 3 + 1
  return { from: iso(y, start, 1), to: iso(y, start + 3, 0) }
})
\`\`\`

Both statements below re-fetch automatically whenever the period selection changes.
A Print button triggers the browser's print dialog.

## Money in and out (the income statement)

Fetched with `GET /reports/income-statement?from=...&to=...`
(`api.incomeStatement()`). Two tables:

- **Money in** - every income account with activity in the period, and a total.
- **Money out** - every expense account with activity in the period, and a total,
  followed by "Left over" (if the period's income exceeded expenses) or "Short by"
  (if it didn't) - this is `income.net_cents` from the API, shown with the sign the
  API already applied.

Accounts with zero activity in the selected period are filtered out client-side
(`nz()` in the page) so a quiet category doesn't clutter a printed handout. The
totals always come from the API, not from the filtered rows, so hiding a zero row
can't skew the numbers.

## What we hold and owe (the balance sheet)

Fetched with `GET /reports/balance-sheet?as_of=<period end>` (`api.balanceSheet()`).
Unlike the income statement, this is a snapshot: it only cares about the last day of
the selected period, not the whole range. Three tables:

- **What we have** - asset accounts and their balances, with a total.
- **What we owe** - liability accounts, with a total, or "Nothing owed" if there are
  none.
- **Our money** - equity accounts, plus a "Kept from all activity to date" line
  (`retained_cents` - retained earnings, in plain English) and a total.

A closing note states the identity the report is built on: what you have always
equals what you owe plus your money, and if those two totals ever disagree,
something's wrong with the books.
