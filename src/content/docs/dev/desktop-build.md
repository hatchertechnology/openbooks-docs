---
title: Building the desktop client
description: Running the desktop client with just desktop, building directly with cargo, and pointing it at a different API.
sidebar:
  order: 15
---

## The easy way: `just desktop`

From the repo root:

```sh
just desktop
```

This recipe (defined in the root `justfile`) brings up postgres and
`openbooks-api` first if they aren't already answering on `localhost:38081`,
then runs `cd openbooks-desktop && cargo run` in the foreground. It's
foreground on purpose — the desktop app is a window, so Ctrl-C is how you
close it, and a compile error should land in your terminal, not only in a log
nobody's tailing.

`just desktop` doesn't start the web dev server; the desktop client has no use
for it.

Already inside `openbooks-desktop/`? `just run` there does the same thing — it
delegates to the root `just desktop` when it finds the superproject's
`justfile` beside it, and falls back to plain `cargo run` when the repo is
checked out standalone.

## Building directly with cargo

If you'd rather not go through `just`, make sure postgres and `openbooks-api`
are already up (`just status` will tell you), then from
`openbooks-desktop/`:

```sh
cargo run
```

The project's `README.md` notes this needs `openbooks-api` on `:38081` — the
app doesn't start its own copy of the API.

### Running the tests

```sh
cargo test                       # money and date logic
cargo test --no-default-features # the above, plus headless render checks
```

The headless render tests (in `openbooks-desktop/src/views/mod.rs`) lay out a
view with no window and assert what it drew — this is how the offline
read-only rule is pinned down, so a delete control renders while online and is
absent (not merely disabled) offline. They need `a11y` compiled out because
ply's `eval()` syncs a live OS accessibility tree and panics without a window,
so the tests only run with `--no-default-features`.

### Screenshotting a screen

Two environment variables let the app photograph itself, which is the only way to
check a layout without sitting at the window:

```sh
export OPENBOOKS_TOKEN=$(just mint-token you@example.com)
OPENBOOKS_VIEW=reports OPENBOOKS_SHOT=/tmp/reports.png cargo run
```

`OPENBOOKS_VIEW` picks the screen (`home`, `transactions`, `reports`; anything
else falls back to `home`) and `OPENBOOKS_SHOT` is the PNG to write. The app
renders about 120 frames so the first sync can land, writes the real framebuffer
and exits.

Set `OPENBOOKS_TOKEN` first or the shot is worthless: without a token every
request 401s, the app falls back to its cache, and you photograph the offline
read-only state with an "Can't reach OpenBooks" banner instead of the screen you
meant to check. It looks like a rendering bug and isn't one.

Worth doing after any layout change. The headless tests above assert *what* was
drawn and never how it looks, so they cannot see a heading overlapped by a button
or a character the bundled font has no glyph for — both of which shipped once and
were caught only by looking.

## Pointing it at a different API

Two ways, and the first wins:

1. **The Settings screen.** Type the address, press **Save and reconnect**, and
   it's stored on this computer (`settings.json`, next to the snapshot cache)
   and read before the first frame on every later launch
   (`openbooks-desktop/src/settings.rs`).
2. **`OPENBOOKS_API`**, falling back to `http://localhost:38081`
   (`openbooks-desktop/src/client.rs`, `base_url()`) — the same mechanism the
   web app uses:

   ```sh
   OPENBOOKS_API=http://box:38081 cargo run
   ```

The environment variable only decides the address while nothing has been saved
in Settings; a saved address overrides it, because it's the one the person at
the window chose. Delete `settings.json` to go back to the variable.

## Other platforms

Ply supports building for other targets through `plyx` (`cargo install
plyx`): `plyx web`, `plyx apk`, `plyx ios`. As of this writing only the
desktop build has actually been exercised — see
[Overview](/openbooks-docs/use/desktop/) for the caveat.

:::caution
Building and running the GUI itself isn't something to script or automate
blindly — it opens a real window. `cargo build` (without `run`) is the safe
way to check that the code compiles without launching anything.
:::
