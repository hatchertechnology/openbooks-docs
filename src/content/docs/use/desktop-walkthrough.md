---
title: Using the desktop app
description: A walkthrough of the desktop client's screens and the mouse and keyboard interactions available on each.
sidebar:
  order: 5
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
accounts exist), a hint says so plainly without naming another client, since a
desktop-only user may not have one. Account creation isn't part of the desktop
client.

Behind the scenes, `openbooks-desktop/src/main.rs::submit` turns the form into
one balanced two-legged transaction: debit positive, credit negative, summing
to zero, exactly like the API and its Postgres trigger require.

## Transactions

Every transaction, newest first (`openbooks-desktop/src/views/transactions.rs`).
Each row shows the date, description, the two accounts money moved between
(`from -> to`, an ASCII arrow because the bundled font is a latin subset with
no `→` glyph), and the amount (the positive leg — a transaction's entries
always sum to zero, so there's no meaningful "total" to show). Rows alternate
background shading for scanability.

While online, each row has a **Delete** button, and deleting takes two presses.
The first press (`Msg::AskDelete`) turns that row's button into "Delete for
good?" with **Confirm** (`Msg::Delete`, which actually sends the request) and
**Cancel** (`Msg::CancelDelete`). Only one row can be awaiting confirmation at a
time, and switching view, refreshing, or a completed delete all clear it. There
is no undo once Confirm is pressed, and no way to edit a transaction, so
delete-and-re-record is the only correction path — which is why the confirmation
exists.

The Delete button is deliberately quiet at rest, turning red only on hover or
press. A list with a delete on every row would otherwise draw a red column down
the page competing with the amounts.

Offline, **none of this renders** — not the Delete button, and not the
confirmation pair even if a row was mid-confirm when the connection dropped.
Nothing is disabled-but-present, so there's no way to queue a delete against an
unreachable API. If there are no transactions yet, the card shows an empty-state
message instead of an empty list.

## Reports

Income statement and balance sheet for one calendar year
(`openbooks-desktop/src/views/reports.rs`):

- A **year switcher** card: **Previous** and **Next** buttons step the year back
  and forward one at a time (`Msg::SetYear`), triggering a fresh sync for that
  year's reports. They're worded rather than arrow glyphs — the bundled font has
  no triangles, and "Previous" reads better to a screen reader than a shape.
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

- **Keyboard and mouse both work.** Every clickable control (nav buttons, mode
  buttons, chips, Refresh, Previous/Next, Record, Delete) responds to a mouse
  click/release, and every one is also a tab stop: `Tab` cycles forward and
  `Shift+Tab` back, in the order the controls appear on screen. A focused
  control draws a blue focus ring, which is deliberately distinct from the
  hover highlight so keyboard focus is never ambiguous. Disabled controls are
  skipped. There are no single-key accelerators or shortcuts.
- **Text fields** (`Date`, `Amount`, `Description`) are click-to-focus and also
  reachable by `Tab`, with the usual cursor and text-selection behavior ply
  provides. `Date` is pre-filled with today.
- **Scrolling** is mouse-wheel/trackpad over the content area below the nav
  and connection banner — it has its own scrollbar that fades out after being
  idle for a while (`openbooks-desktop/src/main.rs`, the `overflow` config in
  `chrome`).
- **Accessibility labels and roles** are attached to buttons, chips, headings,
  and text inputs (`.accessibility(...)` throughout `widgets.rs`), exposed to
  the OS through ply's AccessKit integration, so the app is navigable with a
  screen reader. Chips carry a radio role with their checked state, and
  headings carry a level.
- **Colour is never the only signal.** Money in and money out differ by colour,
  but the row also names the accounts money moved between, so the direction is
  readable without relying on hue.
