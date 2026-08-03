---
title: Install and run
description: Running the desktop client with just desktop, building directly with cargo, and pointing it at a different API.
sidebar:
  order: 2
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
OPENBOOKS_VIEW=reports OPENBOOKS_SHOT=/tmp/reports.png cargo run
```

`OPENBOOKS_VIEW` picks the screen (`home`, `transactions`, `reports`; anything
else falls back to `home`) and `OPENBOOKS_SHOT` is the PNG to write. The app
renders about 120 frames so the first sync can land, writes the real framebuffer
and exits.

Worth doing after any layout change. The headless tests above assert *what* was
drawn and never how it looks, so they cannot see a heading overlapped by a button
or a character the bundled font has no glyph for — both of which shipped once and
were caught only by looking.

## Pointing it at a different API

The desktop client reads the API base URL from the `OPENBOOKS_API` environment
variable, falling back to `http://localhost:38081` if it's unset
(`openbooks-desktop/src/client.rs`, `base_url()`):

```sh
OPENBOOKS_API=http://box:38081 cargo run
```

This is the same mechanism the web app uses to point at a non-default host.

## Other platforms

Ply supports building for other targets through `plyx` (`cargo install
plyx`): `plyx web`, `plyx apk`, `plyx ios`. As of this writing only the
desktop build has actually been exercised — see
[Overview](/openbooks-docs/desktop/overview/) for the caveat.

:::caution
Building and running the GUI itself isn't something to script or automate
blindly — it opens a real window. `cargo build` (without `run`) is the safe
way to check that the code compiles without launching anything.
:::
