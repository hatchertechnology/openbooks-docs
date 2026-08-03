---
title: Running the stack
description: Every just recipe, where the logs go, and how to run the pieces by hand.
sidebar:
  order: 2
---

Drive the dev environment through the `justfile` at the root of the `openbooks` superproject.
It sequences things that need sequencing, waiting for Postgres to report healthy before
migrations run, installing web dependencies on first run, and tracking pids so the servers
can be stopped cleanly. Hand-rolling `docker compose`, `cargo run`, and `npm run dev` gets
those wrong.

## The recipes

| | |
|---|---|
| `just run` | start Postgres, the API, and the web dev server in the background |
| `just desktop` | run the desktop app in the foreground, starting Postgres and the API first if they're down |
| `just cli [args]` | run the terminal UI in the foreground; arguments pass through to the scriptable mode |
| `just docs` | serve this documentation site |
| `just stop` | stop the API, the web dev server, and Postgres |
| `just restart` | stop, then start; recorded data survives |
| `just seed` | load a club's worth of sample data, 2025 through mid-2026 |
| `just reset` | rebuild from scratch, come back up with the sample data loaded |
| `just reset-clean` | rebuild from scratch, stay down, empty database |
| `just status` | what's up right now |
| `just logs` | follow the API and web logs |
| `just smoke` | check the ledger and the reports end to end, needs `jq` |

`just` on its own lists them.

## Ports

| | |
|---|---|
| Web UI | <http://localhost:38080> |
| API | <http://localhost:38081> |
| Postgres | `localhost:5433` on the host |

The API answers `GET /health`, which is what `just status` and the startup waits poll.

## Logs

The API and web dev server run in the background, so nothing prints to your terminal. Output
goes to:

- `.dev/api.log`
- `.dev/web.log`

`just logs` follows both. `.dev/` also holds `api.pid` and `web.pid`, and it's gitignored.

The desktop app, the CLI, and the docs site run in the foreground on purpose. They own your
terminal, ctrl-C stops them, and compile errors land where you can see them.

## Resetting

`just reset` and `just reset-clean` both delete:

- the Postgres volume, which means every recorded transaction
- `openbooks-web/node_modules`, `.nuxt`, and `.output`
- `openbooks-api/target`

They prompt first. Add `-y` to skip the prompt. A full reset costs about a minute because
everything rebuilds, so reach for `just restart` when all you want is fresh processes.

## Running things by hand

If you'd rather not use `just`:

```sh
cd openbooks-api && docker compose -f compose.yaml up -d && cargo run   # migrations run on startup
cd openbooks-web && npm install && npm run dev
cd openbooks-cli && cargo run
cd openbooks-desktop && cargo run
```

The API runs its migrations on startup, so there's no separate migrate step.

## Checking it works

```sh
just smoke
```

`smoke.sh` posts to a running API and asserts real numbers: quarterly totals, a balance sheet
that balances, and rejection of unbalanced and single-legged posts. It works in the year 2099
and deletes everything it finds there, so leave 2099 alone in the sample data.

Run it after touching the ledger or the reports.
