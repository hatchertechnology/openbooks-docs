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

The app opens on a **Sign in** screen when nothing is stored, after signing
out, or after a stored credential the server refuses. **Sign in** opens a
browser at the OAuth authorization endpoint — the same loopback PKCE flow
`openbooks-cli auth login` uses — and the screen waits, with a **Start
over** control if that browser tab was closed or never opened (the wait can
run up to ten minutes before it gives up on its own). Once the browser
completes the exchange, the tokens are stored and the app moves past
sign-in.

**Tokens are stored in the OS keyring, or the mode-`0600` credentials file
if there's no keyring** — the same store `openbooks-cli` uses
(`$XDG_CONFIG_HOME/openbooks/credentials.json`, same keyring entry), so
**signing in once on a machine, from either client, signs both in.** The
app also refreshes the access token *before* it expires rather than waiting
for a `401` — a frame-driven UI can't retry a request that already failed
inside that frame, so it renews with a margin instead. The keyring entry is
service `openbooks`, account `credentials` — the same pair `openbooks-cli`
uses, and the one to check with `security find-generic-password -s openbooks -a
credentials` (macOS) or `secret-tool` (Linux) if you want to see the sharing
for yourself.

Two rules protect the *other* client's sign-in, since the store is shared:

- **A renewal that can't reach the API doesn't sign you out.** Only a renewal
  the server actually *refuses* clears the store; a request that never landed
  leaves it alone and retries about fifteen seconds later. Opening the app
  offline — which it's built for — never costs you a credential.
- **The store is re-read just before every renewal**, off the render thread, so
  if `openbooks-cli` rotated the tokens while the window sat open, the app
  adopts what the CLI wrote instead of spending the pair it remembers.
  Presenting a rotated-past token is read as reuse, and the server answers
  reuse by revoking the whole family — both clients at once.

If a renewal fails, or a fresh sign-in couldn't be saved, the reason is shown
above whatever screen is open and stays there until it's dealt with, rather than
disappearing on the next navigation.

**Access revoked from somewhere else is noticed too.** Renewing early means the
app isn't waiting on a `401` to *renew* — but a `401` is still the only sign that
someone turned this computer's access off, from the web app's Connected programs
section or with `openbooks-cli auth logout`. A revoked credential's recorded
expiry is untouched, so it looks perfectly healthy and the early renewal never
fires. So a `401` on a data request asks for one immediate credential re-check,
which lands the app on **Sign in** saying either "You've been signed out on this
computer" (the store was cleared) or "Your sign-in has run out" (the tokens were
still there, and the server refused them). Nothing else takes that path: a `500`,
a `400`, or an unreachable API all leave the credential alone. See
[Two reasons it goes read-only](/openbooks-docs/use/offline/#two-reasons-it-goes-read-only)
for what the screen says in the meantime.

**Sign out** lives on the **Settings** screen, not as a nav item — it's
rare and mildly destructive, so it sits next to the other machine-level
state. Signing out there also signs `openbooks-cli` out, since the store is
shared.

`OPENBOOKS_TOKEN` still overrides everything, exactly as before: while it's
set, it's what authenticates every request, and Settings says so and shows
no sign-out button, since there's nothing stored to sign out of. Settings
itself stays reachable while signed out, on purpose — it's where the API
address lives, and locking it away would strand a typo with no way back.

See [Authentication](/openbooks-docs/dev/auth/) for the OAuth protocol
underneath, and [Command reference](/openbooks-docs/dev/cli-commands/#auth)
for the equivalent flow in `openbooks-cli`.

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
- **Strictly read-only when offline.** When the desktop app can't reach the API —
  or when the server refuses its credential — recording and deleting are hidden
  outright rather than queued for later, and the "Recording is off" card says
  which of the two it is. The web app doesn't have an offline mode at all; if the
  API is down, it simply fails.
- **Fewer screens.** The desktop client has five views — Sign in, Home,
  Transactions, Reports, Settings (see `openbooks-desktop/src/msg.rs`'s
  `View` enum and `openbooks-desktop/src/views/`) — a narrower slice of the
  API than the web app exposes.

:::note
There's no accounting vocabulary in either client's UI by design. See the
project's root `CLAUDE.md` for the invariants both clients are built to respect
(integer-cent money, signed entries, the deferred Postgres balance trigger).
:::
