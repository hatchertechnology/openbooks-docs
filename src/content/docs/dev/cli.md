---
title: The CLI
description: What openbooks-cli is, how to build and run it, and the split between the interactive TUI and the scriptable subcommands.
sidebar:
  order: 12
---

`openbooks-cli` is a Rust terminal client for [openbooks-api](/openbooks-docs/dev/api/). Run it
with no arguments and it opens a full-screen interactive TUI; give it a subcommand
and it becomes a quiet, scriptable CLI that talks to the same API.

Source lives in `openbooks-cli/src/main.rs`, with the two modes split into
`openbooks-cli/src/cli.rs` (non-interactive) and `openbooks-cli/src/tui.rs`
(interactive). Both go through the same HTTP client in `openbooks-cli/src/api.rs`.

## Building and running it

Use `just` from the repo root:

```bash
just cli                      # the TUI (starts postgres and the api first, if they're down)
just cli balances --json      # arguments pass straight through to the CLI
```

`just cli` runs in the foreground on purpose — the TUI owns the terminal.

To run it directly, with the API already up:

```bash
cd openbooks-cli
cargo run                     # TUI
cargo run -- accounts         # CLI
cargo build --release         # binary at target/release/openbooks-cli
```

Run the test suite with:

```bash
cargo test
```

## Authenticating

Every request needs a bearer token: `openbooks-cli` reads `OPENBOOKS_TOKEN`
from the environment and, when set, sends `Authorization: Bearer
$OPENBOOKS_TOKEN` on every call (`openbooks-cli/src/api.rs`). Get one with:

```bash
export OPENBOOKS_TOKEN=$(just mint-token you@example.com)
```

Without it, a request comes back `401` and the CLI reports:

```
not signed in — export OPENBOOKS_TOKEN=$(just mint-token you@example.com)
```

Phase 1 has no `auth login` in any client — this is the only way
`openbooks-cli` gets a credential until phase 3 adds one. See
[Authentication](/openbooks-docs/dev/auth/) for what the token is good for
and how long it lasts.

## Reaching the API

Every invocation needs a base URL for `openbooks-api`. It comes from, in order of
what clap resolves, a `--api` flag or the `OPENBOOKS_API` environment variable,
falling back to `http://localhost:38081` if neither is set:

```bash
openbooks-cli --api http://localhost:38081 accounts
OPENBOOKS_API=http://localhost:38081 openbooks-cli accounts
```

This is defined once in `openbooks-cli/src/main.rs` as a global clap argument, so it
works identically in front of the TUI and every subcommand:

```rust
#[arg(long, global = true, default_value = "http://localhost:38081", env = "OPENBOOKS_API")]
api: String,
```

If the API isn't reachable, both modes report it plainly rather than panicking —
the CLI prints `GET ... failed — is the API running? (just run)` to stderr and
exits non-zero, and the TUI shows the error in its status bar instead of tearing
down the terminal.

## One-shot commands vs. the interactive TUI

`openbooks-cli` decides which mode to run based on whether a subcommand was given,
in `main.rs`:

```rust
let Some(command) = args.command else {
    let mut terminal = ratatui::init();
    let result = tui::App::new(client).run(&mut terminal);
    ratatui::restore();
    return result;
};
```

- **No subcommand** — opens the [TUI](/openbooks-docs/use/terminal/): four tabs (Dashboard, History,
  Reports, Record) for browsing and entering data interactively. Needs a real
  terminal at least 80x24.
- **A subcommand** (`accounts`, `balances`, `transactions`, `income`,
  `balance-sheet`, `record`) — runs once and exits. See the full
  [command reference](/openbooks-docs/dev/cli-commands/).

The CLI half is designed for scripts: plain aligned text by default, or `--json`
to pass the API's own JSON straight through so `jq` sees exactly what the server
said. Anything that goes wrong exits non-zero with the reason on stderr, so a
script can trust the exit code without parsing output.

:::caution
Amounts are always dollars in, parsed to integer cents without ever touching a
float (`19.99 * 100.0` is `1998.9999...` in binary floating point). Type `45` or
`45.50`, never a pre-multiplied cents value.
:::
