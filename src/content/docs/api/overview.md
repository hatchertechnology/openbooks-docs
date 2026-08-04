---
title: Overview
description: What openbooks-api is, how to run it, and how it authenticates callers.
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
docker compose up -d   # postgres on host port 38083
cargo run               # runs migrations, then listens on :38081
./smoke.sh              # needs jq
```

Logs go to `.dev/api.log` when run through `just`; nothing prints to your
terminal since the servers run in the background. `just status` tells you
what's actually up.

## Base URL and configuration

The API listens on `0.0.0.0:38081` by default. These environment variables
control it:

| Variable | Default | Purpose | Read in |
|---|---|---|---|
| `DATABASE_URL` | `postgres://openbooks:openbooks@localhost:38083/openbooks` | Postgres connection string | `src/main.rs` |
| `BIND_ADDR` | `0.0.0.0:38081` | address the HTTP server binds to | `src/main.rs` |
| `WEB_ORIGIN` | `http://localhost:38080` | the only origin CORS allows to send credentialed requests | `src/lib.rs` |
| `API_ORIGIN` | `http://localhost:38081` | this API's own canonical URL, used as the token audience and in the `WWW-Authenticate` challenge | `src/auth/mod.rs` |
| `SESSION_TTL_DAYS` | `30` | how long a fully authenticated session lasts from creation | `src/auth/session.rs` |

Every example in this section assumes the default, so requests target
`http://localhost:38081`.

## Authentication is required; there's no RBAC

Every route except `GET /health` needs a session cookie or a bearer token —
see [Authentication](/openbooks-docs/api/auth/) for the credential types,
the `/auth/*` routes, login backoff, and what phase 1 doesn't do yet (no
second factor, no OAuth). There's no per-user permission model on top of
that: any authenticated user can read and write the whole ledger. That's
deliberate, not an oversight — see the project's root `CLAUDE.md`.

## CORS is an explicit allowlist

The CORS layer allows exactly one origin — `WEB_ORIGIN` — with credentials,
and only the methods the API actually uses:

```rust
CorsLayer::new()
    .allow_origin([origin])
    .allow_credentials(true)
    .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE, Method::OPTIONS])
    .allow_headers([header::CONTENT_TYPE, header::AUTHORIZATION])
```

The origin is passed as a one-element array rather than a bare value: a bare
`HeaderValue` becomes `AllowOrigin::exact`, which echoes the configured
origin on every response without checking the request's `Origin` header at
all — not actually an allowlist. The array form is `AllowOrigin::list`,
which does filter, so a request from an unrecognized `Origin` gets no
`Access-Control-Allow-Origin` header back. CORS governs whether a browser
lets script *read* a cross-origin response, not whether the request gets
sent — `SameSite=Lax` on the session cookie is what actually protects
state-changing routes from another site.

## Admin commands

User accounts are created and managed on the API binary directly, never over
HTTP — anyone who can run these already has `DATABASE_URL` and could reach
the database directly, so there's no privileged endpoint to protect with a
role this system deliberately doesn't have. Verbatim from `admin::USAGE`:

```
openbooks-api                                     serve
openbooks-api user add <email> [--password -]     create a user, print a password
openbooks-api user list                           email, passkey count, last seen
openbooks-api user passwd <email> [--password -]  reset a password
openbooks-api user rm <email>                     delete, cascading sessions/tokens
openbooks-api mint-token <email> [--label <name>] a token for scripts and clients
```

`user add` and `user passwd` print a generated password once — it's not
stored anywhere and can't be shown again, so write it down or pipe a
password in with `--password -` (reads one line from stdin). `user passwd`
and `user rm` (via the cascading foreign keys in `0004_auth.sql`) end every
existing session and revoke every token for that user, the same as a
self-service password change through `POST /auth/password`.

From the repo root, `just` wraps these so you don't need `DATABASE_URL` set
by hand:

```sh
just user-add you@example.com   # user add
just users                      # user list
just mint-token you@example.com # mint-token
```

See [Running the stack](/openbooks-docs/start/running/) for the full recipe
list.

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
