---
title: Quickstart
description: Clone OpenBooks, bring up Postgres, the API, and the web UI, and record your first transaction.
sidebar:
  order: 2
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

If you already cloned without `--recurse-submodules`:

```sh
git submodule update --init --recursive
```

## Load the sample data

An empty ledger makes for a dull tour. `just seed` posts about 83 transactions across 2025
and the first half of 2026 — monthly dues and hall rent, bake sales and donations, field
trips, insurance, and an invoice bought on credit and partly paid off, so the balance sheet
has something under what you owe — and creates the demo user it posts as:

```sh
just seed
```

On a fresh database, `just seed` prints a password for `demo@example.com`. It's shown once
and isn't stored anywhere, so write it down before you go on to sign in below.

Want your own account instead of the shared demo one?

```sh
just user-add you@example.com
```

That also prints a password once, the same way.

Every month and quarter in the seeded data has activity, so the monthly, quarterly, and
annual reports all have something to show. The amounts are deterministic, so reports are
stable between runs. Running `seed` again replaces what it posted before rather than
doubling it.

## Sign in: password, then a passkey

Every route except `GET /health` requires signing in, and signing in is always two steps —
a password on its own only gets you a ten-minute half-session, good for nothing but the
next step (see [Authentication](/openbooks-docs/dev/auth/) for why). Open
<http://localhost:38080>:

1. **Password.** Enter `demo@example.com` (or your own account) and the password `just seed`
   or `just user-add` printed.
2. **Passkey.** The first time, there's no passkey on the account yet, so the page asks you
   to add one instead of presenting one — click **Add a passkey** and complete whatever your
   browser and OS offer (a platform passkey, a security key, your phone). That one ceremony
   both enrols the credential and finishes signing you in. Every sign-in after this one
   presents that passkey instead of enrolling a new one.

You need a browser and OS that support WebAuthn — a current Chrome, Safari, Firefox, or
Edge, on a device with some way to satisfy "verify it's you" (Touch ID, Windows Hello, a
PIN, a hardware key). The login page says so plainly if yours doesn't.

## Record your first transaction

In the web UI, choose money in or money out, pick an amount, an account, and a category, and
save. The UI never asks you about debits and credits. It composes the two-legged transaction
for you and posts it to the API.

The same thing from the terminal. `openbooks-cli` and `openbooks-desktop` authenticate with a
bearer token rather than a browser session; the normal way to get one is to sign in the same
two-step way as the web app, just from the terminal:

```sh
just cli auth login
```

That opens your browser for the password-and-passkey steps and the same consent screen
[the web app's OAuth flow uses](/openbooks-docs/dev/auth/#post-oauthauthorizeapprove), stores
the resulting tokens, and returns you to the terminal signed in. Then:

```sh
just cli
```

opens the terminal UI. It also takes arguments for the scriptable mode:

```sh
just cli balances --json
```

For a script that can't run an interactive browser flow — CI, a cron job — mint a token
directly instead:

```sh
export OPENBOOKS_TOKEN=$(just mint-token demo@example.com)
just cli balances --json
```

`OPENBOOKS_TOKEN`, when set, is used instead of anything `auth login` stored. See
[The CLI](/openbooks-docs/dev/cli/) for where `auth login`'s tokens live and how the two
ways of authenticating interact.

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
- [Double-entry, explained](/openbooks-docs/use/double-entry/) if you want to know what
  the ledger is actually doing.
- The API, web, CLI, and desktop sections each document one component.
