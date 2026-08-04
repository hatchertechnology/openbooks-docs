---
title: Install
description: Getting a clone of OpenBooks to a running API and web app on your own machine.
sidebar:
  order: 1
---

OpenBooks is five git submodules — `openbooks-api`, `openbooks-web`, `openbooks-cli`,
`openbooks-desktop`, `openbooks-agent` — plus this docs site, wired into one
`openbooks` superproject. Standing up a server for your club or family means
getting the API and the web app running against a Postgres database. This page
covers that; [Postgres](/openbooks-docs/server/postgres/) covers the database in
more depth and [Configuration](/openbooks-docs/server/configuration/) covers every
environment variable.

## What you need

- `git`
- Docker, to run Postgres in a container
- A Rust toolchain, to build the API
- Node, to build the web app
- [`just`](https://github.com/casey/just), which drives the whole thing

`just` on its own lists every recipe. The root `justfile` is what all of the
commands below actually run.

## Clone with submodules

The components live in separate repositories, so a plain clone leaves them
empty:

```sh
git clone --recurse-submodules https://github.com/hatchertechnology/openbooks
cd openbooks
```

Already cloned without `--recurse-submodules`?

```sh
git submodule update --init --recursive
```

## Bring it up

```sh
just run
```

This is the dev harness, and it's worth knowing exactly what it does rather
than treating it as a black box, since it's also what you're running in
production if you don't replace it with something else. `just run` (in the
root `justfile`) calls the shared `_api` recipe, which:

- refuses to start if port 38081 (the API) or 38083 (Postgres) is already
  taken, naming whatever is holding it rather than silently drifting onto a
  different port
- runs `docker compose -f openbooks-api/compose.yaml up -d --wait`, so Postgres
  is up and healthy before anything else happens
- builds the API with `cargo build` — a debug binary, not `--release` —
  specifically so a compile error lands in your terminal rather than only in a
  log nobody's tailing
- backgrounds `openbooks-api/target/debug/openbooks-api`, redirects its output
  to `.dev/api.log`, and records its pid in `.dev/api.pid`

`just run` then does the same for the web dev server: refuses to start on a
taken port 38080, runs `npm install` if `openbooks-web/node_modules` doesn't
exist yet, and backgrounds `npm run dev`, logging to `.dev/web.log` and
tracking `.dev/web.pid`.

The API runs its own database migrations on startup (`sqlx::migrate!()` in
`openbooks-api/src/main.rs`), so there's no separate migrate step — see
[Postgres](/openbooks-docs/server/postgres/) for what the four migrations
create.

`.dev/` is gitignored. `just status` reports what's currently up, `just logs`
tails both log files, and `just stop` kills the tracked pids and runs
`docker compose down`. `just restart` is stop followed by run; recorded data
survives it. `just reset` and `just reset-clean` go further and drop the
Postgres volume, `openbooks-web/node_modules`, and `openbooks-api/target`
entirely — both prompt first, and `-y` skips the prompt.

## Building the pieces by hand

If you'd rather not go through `just`:

```sh
cd openbooks-api && docker compose -f compose.yaml up -d --wait && cargo run
cd openbooks-web && npm install && npm run dev
```

The API still runs its migrations on startup either way.

## The environment it needs

Two variables matter to get a server running at all:

- `DATABASE_URL` — the Postgres connection string. If unset, the API falls
  back to `postgres://openbooks:openbooks@localhost:38083/openbooks`, which is
  exactly what `docker compose -f openbooks-api/compose.yaml up` provisions
  (`openbooks-api/src/main.rs`). Point this at a different Postgres and there's
  nothing else to configure for the database.
- `BIND_ADDR` — what the API listens on, defaulting to `0.0.0.0:38081`
  (`openbooks-api/src/main.rs`). That default binds every interface, not just
  loopback, so the API is already reachable from other machines on your
  network unless you change it.

See [Configuration](/openbooks-docs/server/configuration/) for the full table,
including `WEB_ORIGIN` (the API's CORS allow-list) and the variables each
client reads to find the API.

## Creating a user

There's no signup form — users are created from the command line, never over
HTTP:

```sh
just user-add you@example.com
```

See [Users and tokens](/openbooks-docs/server/users-and-tokens/) for the rest
of the admin commands.
