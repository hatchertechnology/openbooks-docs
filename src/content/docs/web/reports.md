---
title: Statements
description: What the statements screen shows, how the period controls work, and what the printed handout looks like.
sidebar:
  order: 4
---

The Statements screen (`/statements`, `openbooks-web/app/pages/statements.vue`) is
built to be printed or saved as a PDF and handed out at a meeting. The same two
statements also appear on the Overview for the current period — Statements is where
you pick any period and print it.

## Choosing a period

Three choices — **Month**, **Quarter**, **Year** — and depending on which is
selected, a second control appears:

- Month shows a month dropdown (named, not numbered).
- Quarter shows Q1–Q4.
- Year shows nothing extra.

A year dropdown is always present, covering the current year back five years. The
selected period becomes a `from`/`to` range client-side, in
`openbooks-web/app/composables/usePeriod.ts`:

```ts
/** First and last day of the chosen period. Day 0 of month m+1 is the last of m. */
const range = computed(() => {
  const y = year.value
  if (period.value === 'year') return { from: iso(y, 1, 1), to: iso(y, 12, 31) }
  if (period.value === 'month') return { from: iso(y, month.value, 1), to: iso(y, month.value + 1, 0) }
  const start = (quarter.value - 1) * 3 + 1
  return { from: iso(y, start, 1), to: iso(y, start + 3, 0) }
})
```

Both statements re-fetch automatically whenever the selection changes.

### The period lives in the URL

On this route `usePeriod` is called with `syncQuery`, so the choice is mirrored into
the query string (`/statements?period=quarter&year=2026&quarter=2`). That makes a
statement shareable and reload-safe — and it is why the Overview's **Print
statement** button hands its own period across rather than dropping it. Without
that, choosing Q1 2025 on the Overview and pressing Print opened the *current*
quarter, which is a bad way to find out you printed the wrong figures for a meeting.

## What came in and went out

Fetched with `GET /reports/income-statement?from=...&to=...`. Two sections, both
rendered by `openbooks-web/app/components/ObStatementSection.vue`:

- **Where it came from** — every income category with activity in the period, then a
  `Total in` above a 1.5px rule.
- **What it went to** — every expense category with activity, then `Total out`.

Below them, above a heavier 2.5px rule, comes **Left over** — or **Short by** when
more went out than came in. That is `net_cents` from the API, shown with the sign the
API already applied.

Categories with zero activity in the period are filtered out client-side so a quiet
category doesn't clutter a printed handout. The totals always come from the API, not
from the filtered rows, so hiding a zero row can't skew the numbers.

## What we have and what we owe

Fetched with `GET /reports/balance-sheet?as_of=<period end>`. Unlike the income
statement this is a snapshot: it only cares about the last day of the period. Three
sections:

- **What we have** — asset accounts and their balances, with a total.
- **What we owe** — liability accounts, with a total, or "Nothing owed".
- **Our money** — equity accounts, plus a "Kept from all activity to date" line
  (`retained_cents`, in plain English) and a total.

The headings on the first two follow the club/personal setting, so a household reads
"What you have" and "What you owe".

A closing note states the identity the statement is built on: what you have always
equals what you owe plus your money. It is not decoration — the page compares the two
totals, and if they ever disagree it says so in red and prints both figures, because
that means something is wrong with the books.

## The printed handout

Print styling lives in `openbooks-web/app/assets/css/main.css` under `@media print`,
not in a component. On paper:

- **The theme is ignored.** The print block resets the colour tokens to
  black-on-white whatever the screen is wearing, so a dark-mode user doesn't print a
  dark page.
- **Cards stop being cards.** `.sheet` loses its border, radius, shadow and padding,
  so the page reads as a document rather than as screenshots of an interface.
- **Navigation and controls disappear** (`.no-print`), and a masthead the screen
  never shows appears instead: the statement title, the period, the range, and
  "all figures in USD".
- **Every page identifies itself.** A running head repeats the title and period with
  a CSS `counter(page)` page number, because the balance sheet starts a new page
  (`print:break-before-page`) so the handout is always at least two sheets.
- **Column headers carry the currency.** Figures inside the statement print without a
  symbol so the column stays aligned, so the `Amount (USD)` header is what states the
  unit.
- **Table headers repeat** across pages via `thead { display: table-header-group }`.
- **The trend chart becomes a table.** On screen the paired-bar chart is an SVG with a
  screen-reader-only table beside it; in print the chart is hidden and that table
  becomes the real thing, because a chart cannot print usefully at this size.
