---
title: Screens
description: A walkthrough of every route in openbooks-web, what a user does there, and which API calls it makes.
sidebar:
  order: 3
---

Six routes, defined by the files in `openbooks-web/app/pages/`. The sidebar in
`openbooks-web/app/components/ObSidebar.vue` links to five of them under
plain-English labels; the sixth is reached by clicking an account.

The sidebar is more than navigation — it carries the live balances (each asset
account, the total on hand, and anything still owed), so the numbers a treasurer
checks most often are on screen whatever route they're on. Account names in it link
to the drill-down.

## Overview (`/`)

File: `openbooks-web/app/pages/index.vue`.

The home screen *is* the period statement, rather than a grid of summary tiles. Top
to bottom:

1. **A period picker and a link to print** — month, quarter, or year, plus which one.
2. **Three figures** — money in, money out, and what's left over, each with a
   proportion bar so the pair is comparable at a glance. The third figure flips to
   "Short by" when more went out than came in.
3. **The statement** — "Where it came from" and "What it went to" with their
   subtotals, rendered on screen exactly as it prints, closing on a heavier rule
   above the left-over line.
4. **A rail** — money in and out by month for the last twelve months, then the five
   most recent entries.
5. **The record bar** — docked across the bottom edge at desktop width so recording
   never costs a navigation. Below `lg` it becomes an ordinary section at the end of
   the page instead, because a fixed bar tall enough for six stacked fields would
   swallow a phone screen.

A brand-new book gets a designed first-run panel here instead of a screen of zeroes.
See [Reports](/openbooks-docs/use/statements/#first-run) for what it shows and why.

API calls on load: `GET /accounts`, `GET /reports/balances`,
`GET /reports/income-statement` for the chosen period, and `GET /transactions` for
the trailing twelve months (which feeds both the trend and the recent list, so it is
one request, not two). Recording calls `POST /transactions` then refreshes.

## Record money (`/record`)

File: `openbooks-web/app/pages/record.vue`.

The same record component the overview docks, on its own route: this is the phone
path, and what a bookmark or a deep link points at. Rendered stacked rather than as
a bar.

## Activity (`/activity`)

File: `openbooks-web/app/pages/activity.vue`.

Every entry, newest first, at the density a real set of books reaches. Above the
table are a free-text search and four date presets — This month, This quarter, Year
to date, All time.

The date preset is what goes to the server; the search filters what came back, over
both descriptions and account names, so typing doesn't fire a request per keystroke.
At desktop width the table owns its own scroll and the header stays put, which is
what keeps it readable at hundreds of rows.

Each row shows the date, description, a "where it moved" summary built client-side as
`"<destination> ← <source>"`, the amount, and Edit / Delete. Delete opens a
confirmation naming the entry and its amount; Edit opens the edit dialog described in
[Recording money](/openbooks-docs/use/recording-money/#editing-an-entry).

API calls: `GET /transactions` with the preset's `from` (`api.transactions()`),
re-run when the preset changes. Delete calls `DELETE /transactions/:id`.

## Statements (`/statements`)

File: `openbooks-web/app/pages/statements.vue`.

The handout. Same period picker as the overview, plus a Print button, and both
statements for that period: what came in and went out, then what's held and owed.
Everything here is built to leave the screen — see
[Reports](/openbooks-docs/use/statements/) for the tables and the print behaviour.

API calls: `GET /reports/income-statement` with `from`/`to` and
`GET /reports/balance-sheet` with `as_of` set to the period's end date. Both re-run
when the period changes.

## Categories (`/categories`)

File: `openbooks-web/app/pages/categories.vue`.

Where accounts get created and reviewed. A form adds one with a plain-English name
and a "what kind" dropdown (labelled "Where money sits", "Where money comes from",
"What money is spent on", "What we owe", "Starting balances" — see
[Overview](/openbooks-docs/dev/web/) for why). Two of those labels come from the
club/personal skin so a household never reads "we". Duplicate names are rejected
client-side before the request goes out.

Below the form, one card per kind lists the accounts in it with their balances, or
"None yet". Names under the two countable kinds link to the drill-down.

API calls: `GET /accounts` and `GET /reports/balances` on load; the form calls
`POST /accounts` and refetches.

## One account (`/accounts/:id`)

File: `openbooks-web/app/pages/accounts/[id].vue`.

What one account holds now, and every entry that got it there with a running balance.
The API has no per-account endpoint, so this fetches all transactions and filters
client-side, accumulating the running total forward from the oldest entry; the
current balance shown above the table comes from `GET /reports/balances`, which is
the API's own figure rather than a re-derived one.

Rows show the date, description, the other side of the entry, the change to this
account, and the running balance. For income, liability, and equity accounts a note
explains that the figures read the way the statements present them rather than the
way they're stored.

API calls: `GET /transactions` with no range, plus the shared `GET /accounts` and
`GET /reports/balances`. An unknown id renders a "No such account" state rather than
an error.
