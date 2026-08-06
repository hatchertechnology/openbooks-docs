---
title: Offline mode
description: The local JSON snapshot cache and read-only offline mode — where the cache lives, when it's written and read, and what does and doesn't work offline.
sidebar:
  order: 6
---

The desktop client keeps a local copy of the last successful sync so the
window is never empty, and it turns strictly read-only whenever the API can't
be reached. Both behaviors live in `openbooks-desktop/src/cache.rs` and are
wired into the main loop in `openbooks-desktop/src/main.rs`.

## Where the cache lives

One JSON file, written through ply's cross-platform `Storage` API:

- **Namespace:** `openbooks` (`cache::NAMESPACE`) — this becomes the app data
  directory name.
- **File:** `snapshot.json` (`cache::FILE`). The API address saved on the
  Settings screen lives beside it as `settings.json` (`settings::FILE`), in the
  same namespace.

Per the project README, on macOS that resolves to
`~/Library/Application Support/openbooks/snapshot.json`. `Storage` picks the
equivalent platform-appropriate app-data directory on other targets; the code
itself doesn't hardcode a path — it delegates to ply.

The file holds five things: accounts, transactions, balances, the income
statement, and the balance sheet, plus the report year they were fetched for
(`cache::Snapshot`). It's a plain read-only mirror of five API responses, not
a database — deliberately simple enough that deleting the file has no
consequence beyond losing the cache.

## When it's written

`cache::save()` is called from the main loop in `main.rs` right after a sync
pass finishes while online:

```rust
if was_in_flight && !sync.in_flight() && app.link == Link::Online {
  app.error.clear();
  cache::save(&app);
}
```

So the save only happens after a sync pass that was in flight completes *and*
lands the app in `Link::Online`. A failed sync never overwrites a good
snapshot — the whole point is that a bad network moment can't erase a good
cache. The save itself runs as a background job (`jobs::spawn`) and is
fire-and-forget: if writing the file fails, it's logged to stderr and nothing
else happens. Nothing in the UI blocks on it.

## When it's read

Once, at startup, before the first frame is drawn (`main()` in `main.rs`):

```rust
if let Some(snapshot) = cache::load_blocking().await {
  snapshot.apply(&mut app);
  app.showing_cache = true;
}
sync.restart();
```

`load_blocking()` degrades to `None` — never a panic — if the storage
namespace can't be opened, the file doesn't exist, or its contents don't
parse as a `Snapshot`. A missing or corrupt cache just means the app opens
empty and waits on the network, same as a first run.

After loading whatever cache exists, the app immediately kicks off a real
sync (`sync.restart()`). The cache is only ever a starting point for the
current session, not something the app keeps re-reading — it's read exactly
once per launch.

## What works offline, and what doesn't

The moment a sync attempt fails, `App.link` becomes `Link::Offline`
(`Sync::harvest` in `main.rs`). While offline:

- **Works:** everything is still visible — Home's cash total and account
  balances, the Transactions list, the Reports screen — as long as it was
  cached. A banner across the top says so ("Offline — read only." or the
  specific error, e.g. "Can't reach OpenBooks at http://localhost:38081 —
  showing the last saved copy.").
- **Doesn't work:** recording and deleting. `App::can_record()` requires
  `Link::Online`, and the views don't just disable the write controls — they
  omit them:
  - Home's "Record something" card is replaced entirely by a "Recording is
    off" note (`views/home.rs::read_only_note`), whose wording depends on
    *why* — see [Two reasons it goes read-only](#two-reasons-it-goes-read-only)
    below.
  - Transactions' per-row **Delete** button isn't rendered at all
    (`views/transactions.rs`).

  This is a deliberate design choice, not a missing feature: there is no
  queue-and-replay-on-reconnect mechanism. The README is explicit about why —
  "a replay-on-reconnect queue is a good way to post the same payment twice,
  and this is a ledger." Nothing typed while offline is held onto; recording
  is simply unavailable until a sync succeeds again.
- **If there's no cache at all** (first launch against a dead API), the
  screens show their own empty states ("Nothing recorded yet.", "Nothing to
  show yet.") rather than the cached-data banners, and the error reads
  "Can't reach OpenBooks at `<base>`. Nothing cached yet."

## Two reasons it goes read-only

The screen looks the same either way, but the two causes need opposite advice,
so the app distinguishes them:

- **The API can't be reached.** Waiting fixes it. The banner names the address
  ("Can't reach OpenBooks at `<base>` — showing the last saved copy."), and
  Home says "OpenBooks can't be reached, so this is a read-only copy of the
  books. Recording comes back on its own once the connection does." Which is
  true — see [Recovering when the API comes back](#recovering-when-the-api-comes-back).
- **The server refused this computer's access.** Waiting fixes nothing. This is
  what a **Disconnect** in the web app's Connected programs section does, and
  what `openbooks-cli auth logout` does to the shared store. The banner reads
  "Your access to these books was turned off. Sign in again to carry on.", and
  Home's card says "Your access to these books was turned off, so this is a
  read-only copy. Sign in again to start recording."

The app tells them apart by the HTTP status: a `401` on a data request means the
server answered and rejected the credential, which nothing about being offline
can produce (`client::Failure::is_unauthorized`). A `401` triggers one immediate
credential re-check — the pre-emptive renewal alone would never notice, because
a revoked credential's recorded expiry is untouched and still looks healthy.
That re-check settles it within a frame or two, and the app lands on the
**Sign in** screen with the reason on it:

- If the store was **cleared** (`openbooks-cli auth logout`): "You've been
  signed out on this computer. Sign in again to carry on."
- If the tokens are **still there but dead** (a web-app Disconnect): the app
  presents the refresh token, the server refuses it, and the store is cleared
  here too: "Your sign-in has run out. Sign in again to carry on."

A `500`, a `400`, or an unreachable server never take that path — only a `401`
does, and only when the credential is one of this app's own. Under
`OPENBOOKS_TOKEN` there is nothing to re-check and nothing to sign into, so a
`401` there stays an ordinary error.

## Recovering when the API comes back

This is the *unreachable* case; a revoked credential needs a fresh sign-in
instead, and no amount of retrying will bring it back.

Nothing special has to happen — the client already polls every frame. Clicking
**Refresh** (`Msg::Refresh`) or changing the report year (`Msg::SetYear`) both
call `sync.restart()`, which bumps the request generation and fires fresh
requests. The moment a sync pass returns cleanly, `Sync::harvest` flips
`app.link` back to `Link::Online`, the record form and delete buttons
reappear, and the next completed pass writes a fresh snapshot to disk. There's
no manual "go online" action — reconnecting is just a sync that happens to
succeed.
