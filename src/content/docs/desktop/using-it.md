---
title: Using it
description: A walkthrough of the desktop client's screens and the mouse and keyboard interactions available on each.
sidebar:
  order: 3
---

The window has a nav bar across the top and one of three screens below it,
defined in `openbooks-desktop/src/main.rs` (`chrome`, `nav`) and
`openbooks-desktop/src/views/`.

## Nav bar

Always visible. From left to right:

- The "OpenBooks" wordmark.
- **Home**, **Transactions**, **Reports** — click to switch screens
  (`Msg::Go`). The active screen's button is highlighted.
- A connection pill: **Connected**, **Syncing…**, or **Offline**, reflecting
  `App::link`.
- A **Refresh** button that re-fetches everything from the API (`Msg::Refresh`).
  It's disabled while a sync is already in flight.

Directly under the nav, a colored banner appears when relevant: a warning
banner when offline (showing the last error, or "Offline — read only." if
there isn't one), or an info banner reading "Checking for updates…" while the
app is syncing but still showing cached data.

## Home

The default screen (`openbooks-desktop/src/views/home.rs`). Three cards, top
to bottom:

1. **Money on hand** — the total across every cash/bank (asset) account,
   summed from the balances report (`App::cash_on_hand`).
2. **Record something** — the recording form, only shown while online (see
   below). Offline this card is replaced with a "Recording is off" note.
3. **Every account** — a table of every account and its balance. A hint
   clarifies that income and expense rows are running totals since day one,
   not money currently held.

### Recording a transaction

Only available while online (`App::can_record()`, i.e. `Link::Online` and no
write already in flight). The form:

1. Click **Money in**, **Money out**, or **Transfer** to pick the mode
   (`Msg::SetMode`). Switching modes clears the account and category you'd
   picked.
2. Fill in three text fields by clicking into them and typing: **Date**
   (`YYYY-MM-DD`, prefilled with today's date on the first frame), **Amount**
   (dollars, e.g. `12.50`), and **Description**.
3. Click a chip under the account heading to pick where the money is coming
   from or going into, and a chip under the category heading for the other
   side. The labels change with the mode:
   - Money in: "Deposit into" (an asset account) / "Where it came from" (an
     income category).
   - Money out: "Paid from" (an asset account) / "What it was for" (an
     expense category).
   - Transfer: "Out of" / "Into" — both are asset accounts, and the second
     chip list excludes whichever account you picked first.
4. Click **Record** (`Msg::Submit`). The button reads "Saving…" while the
   write is in flight. On success the form's amount and description fields
   clear and a confirmation banner shows the recorded amount; on failure an
   error banner explains why (bad amount, bad date, missing description, or
   nothing picked).

If a mode has no categories to choose from yet (for example, no income
accounts exist), a hint says so and points at the web app to add some —
account creation isn't part of the desktop client.

Behind the scenes, `openbooks-desktop/src/main.rs::submit` turns the form into
one balanced two-legged transaction: debit positive, credit negative, summing
to zero, exactly like the API and its Postgres trigger require.

## Transactions

Every transaction, newest first (`openbooks-desktop/src/views/transactions.rs`).
Each row shows the date, description, the two accounts money moved between
(`from → to`), and the amount (the positive leg — a transaction's entries
always sum to zero, so there's no meaningful "total" to show). Rows alternate
background shading for scanability.

While online, each row has a **Delete** button (`Msg::Delete`) that removes the
transaction. Offline, the delete button is not rendered at all — not merely
disabled — so there's no way to queue a delete against an unreachable API. If
there are no transactions yet, the card shows an empty-state message instead
of an empty list.

## Reports

Income statement and balance sheet for one calendar year
(`openbooks-desktop/src/views/reports.rs`):

- A **year switcher** card: `◀` and `▶` buttons step the year back and
  forward one at a time (`Msg::SetYear`), triggering a fresh sync for that
  year's reports.
- **Money in and out** — income and expense line items with their totals, and
  a highlighted "Money left over" (net) figure.
- **What we own and owe** — assets, liabilities, and "Funds" (equity,
  including a synthetic "Kept from money in and out" line for retained
  earnings, since the POC never closes profit into an equity account), each
  with section totals and a grand total. A banner at the bottom spells out in
  plain language whether the sheet balances: what's owned equals what's owed
  plus funds.

Both report cards show "Nothing to show yet" until the first sync for that
year lands.

## Interactions in general

- **Mouse only for navigation and selection.** Every clickable control
  (nav buttons, mode buttons, chips, Refresh, year arrows, Record, Delete)
  responds to a mouse click/release; there are no keyboard shortcuts or
  accelerator keys defined anywhere in the source.
- **Text fields** (`Date`, `Amount`, `Description`) are ordinary click-to-focus,
  type-to-edit inputs, with the usual cursor and text-selection behavior ply
  provides. There's no tabbing order or hotkey wired up between them.
- **Scrolling** is mouse-wheel/trackpad over the content area below the nav
  and connection banner — it has its own scrollbar that fades out after being
  idle for a while (`openbooks-desktop/src/main.rs`, the `overflow` config in
  `chrome`).
- **Accessibility labels** are attached to buttons, chips, headings, and text
  inputs (`.accessibility(...)` calls throughout `widgets.rs`), so the app is
  navigable with a screen reader even though there's no separate keyboard-only
  interaction path documented in the code.
