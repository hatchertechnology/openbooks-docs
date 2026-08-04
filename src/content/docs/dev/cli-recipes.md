---
title: Recipes
description: Task-oriented examples for recording money, checking balances, pulling reports, and scripting openbooks-cli in a shell pipeline.
sidebar:
  order: 14
---

Short, task-first examples using the [CLI subcommands](/openbooks-docs/dev/cli-commands/). Assume
the API is up (`just run`) and reachable at the default
`http://localhost:38081`, or export `OPENBOOKS_API` if it's elsewhere:

```bash
export OPENBOOKS_API=http://localhost:38081
```

## Record income

```bash
openbooks-cli record in --amount 25.00 --account "Cash Box" --category Dues \
  --date 2026-04-01 --description "Cash dues, April meeting"
```

`in` debits the account the money landed in (`Cash Box`) and credits the income
category (`Dues`). `--account` and `--category` accept a name, an unambiguous
prefix of a name, or a numeric id — see [command reference](/openbooks-docs/dev/cli-commands/#record)
for the resolution rules.

## Record an expense

```bash
openbooks-cli record out --amount 45.00 --account checking --category Food \
  --date 2026-03-05 --description "Meeting pizza"
```

`out` debits the expense category (`Food`) and credits the account it was paid
from (`checking`, which resolves by prefix to "Checking Account").

## Move money between accounts

```bash
openbooks-cli record transfer --amount 200.00 --account "Checking Account" \
  --category "Cash Box" --date 2026-05-01 --description "Move cash to petty cash box"
```

For `transfer`, `--category` is the *destination* account, not a category — the
flag name is shared with `in`/`out` but means something different here.

## Check balances

```bash
openbooks-cli balances
```

```
Checking Account   $6,811.50
Cash Box              $76.60
Food                  $565.00
```

To check one account, pipe through `grep`, or use `--json` with `jq`:

```bash
openbooks-cli balances --json | jq -r '.[] | select(.account == "Checking Account") | .cents'
```

That prints raw cents (an integer), since the API's JSON is passed through
untouched — divide by 100 yourself if you want dollars in a script.

## Pull a report for a quarter

```bash
openbooks-cli income --from 2026-04-01 --to 2026-06-30
```

```
Money in and out — 2026-04-01 through 2026-06-30

MONEY IN
Dues       $1,965.00
--------------------
Total in   $4,200.00
...
Left over: $1,590.00
```

For the balance sheet as of the end of the same quarter:

```bash
openbooks-cli balance-sheet --as-of 2026-06-30
```

Watch for the "WARNING: what we have does not equal what we owe plus our money"
line — the CLI prints it if the totals ever fail to balance, which should never
happen given the ledger's own invariants, but it's a cheap tripwire for a script
that trusts the numbers.

## List recent transactions

```bash
openbooks-cli transactions --from 2026-01-01 --to 2026-03-31
```

Leave both dates off to get everything:

```bash
openbooks-cli transactions
```

## Scripting: `jq` pipelines

`--json` on every read command emits the API's own response shape untouched, so
`jq` sees exactly what the server said — no CLI-specific wrapper to learn.

Total spent on Food this quarter:

```bash
openbooks-cli income --from 2026-04-01 --to 2026-06-30 --json \
  | jq '.expenses[] | select(.account == "Food") | .cents'
```

All account names as a plain list, for feeding into another tool:

```bash
openbooks-cli accounts --json | jq -r '.[].name'
```

Fail a CI-style check if the books don't balance, without parsing text output:

```bash
#!/usr/bin/env bash
set -euo pipefail
sheet=$(openbooks-cli balance-sheet --as-of "$(date +%F)" --json)
assets=$(jq '.total_assets_cents' <<<"$sheet")
liab=$(jq '.total_liabilities_cents' <<<"$sheet")
equity=$(jq '.total_equity_cents' <<<"$sheet")
if [ "$assets" -ne "$((liab + equity))" ]; then
  echo "books do not balance" >&2
  exit 1
fi
```

Every subcommand exits `1` on any failure (bad flags, an unreachable API, a
rejected transaction) with the reason on stderr — see
[exit codes](/openbooks-docs/dev/cli-commands/#exit-codes) — so `set -euo pipefail` is enough to
stop a script at the first real problem rather than needing to inspect output.

## Batch-record several transactions from one day

The CLI has no batch mode, but nothing stops looping over a shell array — each
invocation is a separate process and a separate API call:

```bash
while IFS=, read -r amount account category description; do
  openbooks-cli record out --amount "$amount" --account "$account" \
    --category "$category" --date 2026-03-05 --description "$description"
done <<'CSV'
45.00,Checking Account,Food,Meeting pizza
12.50,Cash Box,Supplies,Name tags
CSV
```

If you're entering many transactions from the same day interactively rather than
from a script, the [TUI's Record tab](/openbooks-docs/use/terminal/#record-tab-only) keeps the date
field after each save, which is faster for that specific case.
