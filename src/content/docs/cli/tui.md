---
title: The TUI
description: Launching the interactive terminal UI, its four tabs, every keybinding, and the focus and terminal-size rules that govern it.
sidebar:
  order: 3
---

Running `openbooks-cli` (or `just cli`) with no subcommand opens a full-screen
interactive terminal UI built on [ratatui](https://ratatui.rs) and
[crossterm](https://github.com/crossterm-rs/crossterm). It's implemented in
`openbooks-cli/src/tui.rs`.

## Launching it

```bash
just cli          # starts postgres and the api first, if they're down
```

or, with the API already running:

```bash
cd openbooks-cli
cargo run
```

:::caution
The TUI needs a real terminal — it will hang or behave oddly if run without one
(for example, piped, redirected, or under an agent that has no TTY attached).
Use the [CLI subcommands](/openbooks-docs/cli/commands/) for anything scripted.
:::

## Terminal size

The TUI requires at least **80 columns by 24 rows** (`MIN_WIDTH`/`MIN_HEIGHT` in
`tui.rs`). Below that, it draws a centered message instead of the UI:

```
Terminal too small

70x20 — needs at least 80x24
```

It re-checks on every draw, so resizing your terminal window up past the minimum
brings the layout back without restarting.

## Layout

Every screen has the same three-part frame:

- **Header** — a fixed-position tab strip (`OpenBooks`) on the left, and "on
  hand" (the sum of every asset account's balance) on the right.
- **Body** — whichever tab is selected.
- **Footer** — either the most recent status message (success in one style,
  error in another), or a reminder of the keys active on the current tab.

The four tabs, always in the same order:

| Tab | Shows |
|---|---|
| **Dashboard** | Balance of every account. |
| **History** | Every transaction, newest first. |
| **Reports** | Money in/out and what's held/owed, for a month, quarter, or year. |
| **Record** | A form to log money in, money out, or a transfer. |

## Colour and accessibility

Colour is used only as reinforcement, never as the sole signal. Setting `NO_COLOR`
(any value, unset to re-enable) drops every foreground colour and falls back to
bold/dim modifiers and position — so hierarchy still comes through in a
monochrome terminal. The selected row always uses reverse video regardless of
`NO_COLOR`, and the Record form's focused field always gets a leading `>` marker
independent of styling.

## Keybindings

`Ctrl-C` quits from anywhere and takes priority over every other binding. Any key
closes the help overlay (`?`) without otherwise acting.

### Global (every tab)

| Key | Action |
|---|---|
| `Tab` / `Shift-Tab` | Next / previous tab |
| `→` / `l` | Next tab (same as `Tab`) |
| `←` / `h` | Previous tab (same as `Shift-Tab`) |
| `1` `2` `3` `4` | Jump straight to Dashboard / History / Reports / Record |
| `j` / `↓` | Move selection down |
| `k` / `↑` | Move selection up |
| `g` | Jump to the first row |
| `G` | Jump to the last row |
| `r` | Reload from the API |
| `?` | Show the help overlay |
| `q` / `Esc` | Quit |
| `Ctrl-C` | Quit, unconditionally |

`j`/`k`/`g`/`G` only affect the Dashboard and History tabs — Reports and Record
have no selectable row list.

### Reports tab only

| Key | Action |
|---|---|
| `m` | Switch to monthly view |
| `Q` | Switch to quarterly view (the default) |
| `y` | Switch to annual view |
| `[` | Shift to the previous period |
| `]` | Shift to the next period |

### History tab only

| Key | Action |
|---|---|
| `d` | Delete the selected transaction |

Deleting calls the API directly (`DELETE /transactions/:id`) and refreshes the
list; there's no undo, and no confirmation prompt.

### Record tab only

The Record tab is a form. While it's focused, plain character keys are captured
by the active field instead of triggering the global bindings above (so, for
example, typing a digit while the Amount field is focused appends to the amount
rather than jumping to a tab).

| Key | Action |
|---|---|
| `Tab` / `↓` | Move to the next field |
| `Shift-Tab` / `↑` | Move to the previous field |
| `←` / `→` | Change value: cycles "What happened" (in/out/transfer), or cycles the offered account/category |
| Digits, `.`, `-` | Typed into the Date or Amount field (as appropriate) |
| any printable character | Typed into the Description field |
| `Backspace` | Delete the last character of the focused text field |
| `Enter` | Submit the form |
| `Esc` | Clear the whole form |
| `?` | Show help (same as elsewhere) |

Field order is fixed: **What happened → Date → Amount → Account → Category →
Description**, and `Tab`/`Shift-Tab` wrap around at each end.

## Focus and navigation model

- The Dashboard and History tabs share one `TableState` selection cursor, reset
  to row 0 whenever you switch tabs.
- The Record form has its own, separate focus concept — which *field* is active
  — tracked independently of the tab-level selection.
- "What happened" (In / Out / Transfer) changes which accounts are offered as
  the category: In offers income accounts, Out offers expense accounts,
  Transfer offers every other asset account (never the one already picked as
  the source). Changing "What happened" or the source account resets the
  category selection back to the first option, since the old choice may no
  longer be valid.
- After a successful submit, the form resets except for the date — entering
  several transactions from the same day is the common case, so the date is
  kept and everything else is cleared.

## Reports periods

The Reports tab defaults to the current quarter and lets you page through
periods with `[`/`]` without leaving the tab; each shift reissues both API
calls (income statement and balance sheet) for the new range. Month, quarter,
and year all compute their end date as "day 1 of the next period, minus one
day" — no per-month length table, and leap Februaries fall out of it for free.

## Errors

An API failure (unreachable server, a 4xx/5xx from a request) never tears down
the terminal. It's caught, the root cause is put in the footer's status message
in the error style, and the TUI keeps running so you can retry with `r` or fix
the API and continue.
