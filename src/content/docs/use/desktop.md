---
title: The desktop app
description: What openbooks-desktop is, which platforms it targets, the stack, and how it differs from the web app.
sidebar:
  order: 4
---

`openbooks-desktop` is a native client for OpenBooks, built in Rust on top of
[ply-engine](https://github.com/TheRedDeveloper/ply-engine) — a UI engine that
renders the same code across desktop, mobile, and the web. It talks to the same
`openbooks-api` the Nuxt web app talks to; it's a second front end on the same
ledger, not a separate copy of the logic.

## Platforms

The desktop build (`cargo run`, targeting Linux, macOS, and Windows) is the one
that's actually been exercised. Ply also supports Android, iOS, and a web/WASM
target through a separate tool called `plyx` (`cargo install plyx`): `plyx web`,
`plyx apk`, `plyx ios`. Per the project README, only the desktop build has been
tried so far — treat the other targets as theoretically reachable, not verified.

## Authenticating

Like `openbooks-cli`, the desktop client reads a bearer token from
`OPENBOOKS_TOKEN` (`openbooks-desktop/src/client.rs`) and sends it as
`Authorization: Bearer $OPENBOOKS_TOKEN` on every request; without it, every
call gets a `401`. Get a token with `just mint-token you@example.com` before
running `just desktop`. There's no `auth login` screen in phase 1 — see
[Authentication](/openbooks-docs/dev/auth/) — so this is the only way in
until phase 3.

## Stack

- **Rust**, edition 2021.
- **ply-engine** for the UI: immediate-mode rendering, layout, text input,
  accessibility, and — via its `net` and `storage` features — HTTP and local
  file persistence. See `openbooks-desktop/Cargo.toml` for the exact feature
  flags in use (`net`, `net-json`, `storage`, plus `a11y` on by default).
  Ply builds on `macroquad`/`miniquad` for the window and rendering.
  `openbooks-desktop/src/main.rs` sets up the window (1100x780, high DPI,
  4x MSAA) and runs the main loop.
- **serde** / **serde_json** for the wire types in `openbooks-desktop/src/api.rs`
  and the local snapshot in `openbooks-desktop/src/cache.rs`.
- No database, no ORM. State lives in memory for the running app and as one JSON
  file on disk for the offline cache (see [Offline mode](/openbooks-docs/use/offline/)).

## How it differs from the web app

Both clients are thin: they compose the same two-legged, debit/credit
transactions and let the API and its Postgres trigger enforce that entries
balance. Neither surfaces accounting vocabulary — a user picks an amount, an
account, and a category. The differences are about deployment shape, not
behavior:

- **No server-side rendering or Node runtime.** The desktop client is a single
  compiled binary that opens a native window; there's no dev server, no build
  step for the browser, no CORS concern client-side.
- **Local cache.** The desktop client keeps a snapshot of the last successful
  sync on disk and can open with data on screen before it's touched the
  network. The web app has no equivalent — it always talks to the API live.
- **Strictly read-only when offline.** When the desktop app can't reach the API,
  recording and deleting are hidden outright rather than queued for later. The
  web app doesn't have an offline mode at all; if the API is down, it simply
  fails.
- **Fewer screens.** The desktop client has three views — Home, Transactions,
  Reports (see `openbooks-desktop/src/msg.rs`'s `View` enum and
  `openbooks-desktop/src/views/`) — a narrower slice of the API than the web
  app exposes.

:::note
There's no accounting vocabulary in either client's UI by design. See the
project's root `CLAUDE.md` for the invariants both clients are built to respect
(integer-cent money, signed entries, the deferred Postgres balance trigger).
:::
