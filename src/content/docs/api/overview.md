---
title: Overview
description: What openbooks-api is, how to run it, and its no-auth POC posture.
sidebar:
  order: 1
---

`openbooks-api` is a Rust HTTP API for double-entry bookkeeping. It's built for a
family or club that wants a real ledger — money in, money out, moved between
accounts — without anyone involved needing to know what "double-entry" means.

The stack is [axum](https://github.com/tokio-rs/axum) on top of Postgres, accessed
through [sqlx](https://github.com/launchbadge/sqlx). Source lives in
`openbooks-api/src/main.rs`. An MCP server is mounted alongside the HTTP routes so an
AI assistant can read the books and record transactions the same way the web UI
does; see [MCP server](/openbooks-docs/api/mcp/).

## Running it

Use `just` from the repo root rather than driving Docker or `cargo` by hand:

```sh
just run      # starts postgres, api, and web in the background
just seed     # loads deterministic sample data (2025 through mid-2026)
just smoke    # end-to-end ledger and report check (needs jq)
just stop     # stop everything
```

`just run` waits for Postgres to be healthy before running migrations. Migrations
run automatically on API startup (`sqlx::migrate!().run(&pool)` in
`openbooks-api/src/main.rs`) — there's no separate migration step to remember.

If you want to run the API directly instead of through `just`:

```sh
docker compose up -d   # postgres on host port 5433
cargo run               # runs migrations, then listens on :38081
./smoke.sh              # needs jq
```

Logs go to `.dev/api.log` when run through `just`; nothing prints to your
terminal since the servers run in the background. `just status` tells you
what's actually up.

## Base URL and configuration

The API listens on `0.0.0.0:38081` by default. Two environment variables control it,
both read in `openbooks-api/src/main.rs`:

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `postgres://openbooks:openbooks@localhost:5433/openbooks` | Postgres connection string |
| `BIND_ADDR` | `0.0.0.0:38081` | address the HTTP server binds to |

Every example in this section assumes the default, so requests target
`http://localhost:38081`.

## No auth, no RBAC, CORS wide open

This is deliberate for the POC, not an oversight. There is no login, no API key, no
per-user permission model, and the CORS layer is `CorsLayer::permissive()` — any
origin can call it. The comment in the source is explicit about this:

```rust
// ponytail: POC has no auth, so CORS is wide open. Tighten alongside auth.
.layer(CorsLayer::permissive())
```

Anything that can reach port 38081 can read and write the ledger. Don't put real
money data behind this API, and don't treat the lack of auth as a bug to fix
unless you're explicitly asked to.

## Error shape

Handler errors come back as JSON with a single `error` field:

```json
{ "error": "needs 2+ entries summing to zero (got 1 entries summing to 4500)" }
```

This is produced by `AppError`'s `IntoResponse` impl in `openbooks-api/src/main.rs`.
Two things map to `400 Bad Request`:

- The API's own validation (missing name, empty description, unbalanced entries).
- A Postgres error whose code is `P0001` (a `plpgsql raise exception`, which is how
  the balance-check trigger reports a violation) or starts with `23` (a constraint
  violation, such as an unknown `account_id`).

Everything else — a real database or server fault — comes back as
`500 Internal Server Error` with the underlying error message in `error`.

:::note
The `400` cases above are the ledger's own invariants rejecting bad input, not the
API guessing. The authoritative check is a Postgres trigger described in
[Data model](/openbooks-docs/api/data-model/); the API-level check in `create_transaction_data`
exists only to return a friendlier message before the trigger would fire.
:::
