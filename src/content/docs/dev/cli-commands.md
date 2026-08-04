---
title: Command reference
description: Every openbooks-cli subcommand, its arguments and options, output format, and exit codes, with a worked example each.
sidebar:
  order: 13
---

This page covers the non-interactive half of `openbooks-cli` — everything you get
by passing a subcommand instead of launching the [TUI](/openbooks-docs/use/terminal/). Definitions come
from the `clap` derive in `openbooks-cli/src/main.rs`; the handlers themselves live
in `openbooks-cli/src/cli.rs`.

## Global options

These apply to every subcommand, defined once as global clap arguments:

| Flag | Default | Purpose |
|---|---|---|
| `--api <API>` | `http://localhost:38081` | Base URL of the API. Also settable via the `OPENBOOKS_API` environment variable. |
| `--json` | off | Emit the API's own JSON response instead of aligned text. |
| `-h`, `--help` | — | Print help for the command (or `-h` for a summary). |
| `-V`, `--version` | — | Print the CLI's version. |

## Exit codes

There is exactly one failure path. `main()` runs everything through `run()`; any
error — a clap parse failure, a bad flag value, an API error, a network failure —
is printed to stderr as `error: <context chain>` and the process exits `1`.
Success exits `0`. There's no second error code to distinguish "bad input" from
"API unreachable"; scripts should read stderr for that.

## `accounts`

List every account and its id.

```
Usage: openbooks-cli accounts [OPTIONS]
```

No arguments beyond the globals. Output is a table of id, name, and kind
(`Asset`, `Liability`, `Equity`, `Income`, `Expense`) in text mode, or the raw
`Account[]` JSON with `--json`.

```console
$ openbooks-cli accounts
    1  Checking Account   Asset
    2  Cash Box           Asset
    3  Dues               Income
    7  Food               Expense

$ openbooks-cli accounts --json | jq '.[] | select(.kind == "asset")'
{
  "id": 1,
  "name": "Checking Account",
  "kind": "asset"
}
```

## `balances`

Balance of every account, as a two-column table (account, balance) with no total
row — this is a flat listing, not a statement.

```
Usage: openbooks-cli balances [OPTIONS]
```

No arguments beyond the globals.

```console
$ openbooks-cli balances
Checking Account   $6,811.50
Cash Box              $76.60
Food                  $565.00
```

## `transactions`

Individual transactions, newest first.

```
Usage: openbooks-cli transactions [OPTIONS] --from <FROM> --to <TO>
```

| Option | Required | Default | Meaning |
|---|---|---|---|
| `--from <FROM>` | no | `""` (unset) | Only transactions on or after this date (`YYYY-MM-DD`). |
| `--to <TO>` | no | `""` (unset) | Only transactions on or before this date (`YYYY-MM-DD`). |

Both flags default to an empty string, which the client omits from the request
entirely rather than sending `from=` — so leaving both off returns every
transaction. Neither flag is validated as a date by the CLI itself; it's passed
straight to the API as a query parameter.

Each text-mode row shows id, date, amount, a truncated description (28 characters,
with an ellipsis), and a flow summary like `Food ← Checking Account` (where the
money landed, then where it came from).

```console
$ openbooks-cli transactions --from 2026-01-01 --to 2026-03-31
   42  2026-03-05        $45.00  Meeting pizza                Food ← Checking Account
   41  2026-02-14       $196.50  February dues                Checking Account ← Dues
```

## `income`

Money in, money out, and the net for a period — the CLI's rendering of the API's
income statement.

```
Usage: openbooks-cli income --from <FROM> --to <TO> [OPTIONS]
```

| Option | Required | Meaning |
|---|---|---|
| `--from <FROM>` | yes | Start of the period (`YYYY-MM-DD`). |
| `--to <TO>` | yes | End of the period (`YYYY-MM-DD`). |

Unlike `transactions`, both dates are required and validated: `require_date` in
`cli.rs` rejects an empty or unparsable value, and the command also rejects
`--to` being before `--from`. Text mode lists non-zero income and expense lines
each with a total, then "Left over" (net positive) or "Short by" (net negative).

```console
$ openbooks-cli income --from 2026-04-01 --to 2026-06-30
Money in and out — 2026-04-01 through 2026-06-30

MONEY IN
Dues       $1,965.00
--------------------
Total in   $4,200.00

MONEY OUT
Food         $565.00
----------------------
Total out  $2,610.00

Left over: $1,590.00
```

## `balance-sheet`

What we hold and owe, as of one date.

```
Usage: openbooks-cli balance-sheet --as-of <AS_OF> [OPTIONS]
```

| Option | Required | Meaning |
|---|---|---|
| `--as-of <AS_OF>` | yes | The date to report as of (`YYYY-MM-DD`). |

Text mode prints three sections — "WHAT WE HAVE" (assets), "WHAT WE OWE"
(liabilities), and "OUR MONEY" (equity, plus a synthesized "Kept from all activity
to date" line for retained earnings) — each with a total. If the totals don't
balance (assets ≠ liabilities + equity), it prints a warning line rather than
failing; this is a tripwire for a script piping the output, not a fatal error.

```console
$ openbooks-cli balance-sheet --as-of 2026-06-30
What we hold and owe — as of 2026-06-30

WHAT WE HAVE
Checking Account   $6,666.50
--------------------------
Total              $7,151.50

WHAT WE OWE
Unpaid Bills         $360.00
----------------------------
Total owed           $360.00

OUR MONEY
Opening Balance             $2,700.00
Kept from all activity to date  $4,091.50
------------------------------------
Total                       $6,791.50
```

## `record`

Record money received, spent, or moved. This is the only mutating command.

```
Usage: openbooks-cli record [OPTIONS] --amount <AMOUNT> --account <ACCOUNT> --category <CATEGORY> --date <DATE> --description <DESCRIPTION> <KIND>
```

| Argument/Option | Required | Meaning |
|---|---|---|
| `<KIND>` (positional) | yes | `in`, `out`, or `transfer` — what happened. |
| `--amount <AMOUNT>` | yes | Dollars, e.g. `45` or `45.50`. Parsed to integer cents, never through a float. |
| `--account <ACCOUNT>` | yes | The bank or cash account, by name, unambiguous name prefix, or id. |
| `--category <CATEGORY>` | yes | An income/expense category for `in`/`out`, or the destination account for `transfer`. Same name/prefix/id resolution as `--account`. |
| `--date <DATE>` | yes | When it happened (`YYYY-MM-DD`). |
| `--description <DESCRIPTION>` | yes | Short description; must not be blank. |

`KIND` determines which side of the transaction is debited (`legs()` in
`openbooks-cli/src/api.rs`):

- **`in`** — money received. Debits `--account`, credits `--category`.
- **`out`** — money spent. Debits `--category`, credits `--account`.
- **`transfer`** — money moved between two accounts. Debits `--category`
  (read here as "destination account"), credits `--account`.

Account resolution (`find()` in `cli.rs`) tries, in order: exact numeric id, exact
case-insensitive name match, then an unambiguous case-insensitive name prefix. A
prefix matching more than one account (e.g. `--account F` when both "Food" and
"Fees" exist) is a hard error rather than a guess, and the error message lists the
candidates. `--account` and `--category` resolving to the same account id is also
rejected.

On success, text mode prints a one-line confirmation; `--json` prints
`{"id": <transaction id>, "recorded_cents": <cents>}`.

```console
$ openbooks-cli record out --amount 45.00 --account checking --category Food \
    --date 2026-03-05 --description "Meeting pizza"
Recorded $45.00 — Meeting pizza (2026-03-05)

$ openbooks-cli record in --amount 25 --account "Cash Box" --category Dues \
    --date 2026-04-01 --description "Cash dues, April meeting" --json
{
  "id": 43,
  "recorded_cents": 2500
}
```

There is no `delete` subcommand — deleting a transaction is only available from
the [TUI's History tab](/openbooks-docs/use/terminal/) (the `d` key), or directly against the API.
