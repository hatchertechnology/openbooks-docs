---
title: Quickstart
description: Clone OpenBooks, bring up Postgres, the API, and the web UI, and record your first transaction.
sidebar:
  order: 1
---

## What you need

- `git`
- Docker (Postgres runs in a container)
- A Rust toolchain, for the API and the two native clients
- Node, for the web UI
- [`just`](https://github.com/casey/just), which drives everything
- `jq`, only if you want to run `just smoke`

## Clone and run

The components live in separate repositories, wired into the `openbooks` superproject as
submodules, so clone recursively:

```sh
git clone --recurse-submodules https://github.com/hatchertechnology/openbooks
cd openbooks
just run
```

`just run` brings up Postgres on host port 38083, the API on port 38081, and the web UI on
port 38080, all in the background. It waits for Postgres to report healthy before the API
runs its migrations, and installs the web dependencies on first run. Then it hands your
prompt back and prints what's up.

Open <http://localhost:38080>. The API seeds a starter chart of accounts on first migration,
so you can record something straight away.

If you already cloned without `--recurse-submodules`:

```sh
git submodule update --init --recursive
```

## Load the sample data

An empty ledger makes for a dull tour. `just seed` posts about 83 transactions across 2025
and the first half of 2026: monthly dues and hall rent, bake sales and donations, field
trips, insurance, and an invoice bought on credit and partly paid off, so the balance sheet
has something under what you owe.

```sh
just seed
```

Every month and quarter has activity, so the monthly, quarterly, and annual reports all have
something to show. The amounts are deterministic, so reports are stable between runs.
Running `seed` again replaces what it posted before rather than doubling it.

## Record your first transaction

In the web UI, choose money in or money out, pick an amount, an account, and a category, and
save. The UI never asks you about debits and credits. It composes the two-legged transaction
for you and posts it to the API.

The same thing from the terminal:

```sh
just cli
```

That opens the terminal UI. It also takes arguments for the scriptable mode:

```sh
just cli balances --json
```

## Stop, restart, start over

```sh
just stop           # stop the api, the web dev server, and postgres
just restart        # fresh processes; recorded data survives
just reset          # rebuild from scratch, come back up with sample data
just reset-clean    # rebuild from scratch, stay down, empty database
```

Both resets drop the database volume, `node_modules`, and `target`, and prompt before
deleting. Add `-y` to skip the prompt. They cost about a minute, so prefer `just restart`
when all you need is fresh processes.

:::tip
`just status` before you assume something's broken. A failed request is often a server that
was never started.
:::

## Where to go next

- [Running the stack](/openbooks-docs/start/running/) covers the rest of the `just` recipes,
  where the logs go, and running things without `just`.
- [Double-entry, explained](/openbooks-docs/concepts/double-entry/) if you want to know what
  the ledger is actually doing.
- The API, web, CLI, and desktop sections each document one component.
