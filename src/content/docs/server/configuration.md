---
title: Configuration
description: Every environment variable the API and clients read, what each one defaults to, and the port map.
sidebar:
  order: 3
---

OpenBooks configures itself entirely through environment variables — there's
no config file to edit. Every variable below has a default, so nothing here
is required to get a server running; you set one when a default doesn't fit
your setup.

## The API

| Variable | Default | Read in | Purpose |
|---|---|---|---|
| `DATABASE_URL` | `postgres://openbooks:openbooks@localhost:38083/openbooks` | `src/main.rs` | Postgres connection string |
| `BIND_ADDR` | `0.0.0.0:38081` | `src/main.rs` | address and port the API listens on |
| `WEB_ORIGIN` | `http://localhost:38080` | `src/lib.rs` | the only origin the CORS layer allows to send credentialed requests |
| `API_ORIGIN` | `http://localhost:38081` | `src/auth/mod.rs` | the API's own canonical URL — the audience bound to every bearer token, and the host in the `.well-known/oauth-protected-resource` URL of the 401 challenge |
| `SESSION_TTL_DAYS` | `30` | `src/auth/session.rs` | how many days a signed-in web session lasts before it expires |

`DATABASE_URL`'s default happens to match exactly what
`docker compose -f openbooks-api/compose.yaml up` provisions (see
[Postgres](/openbooks-docs/server/postgres/)), which is why `just run` needs
nothing set to work against the bundled container. Point it at a different
Postgres instance — a different host, a managed instance, different
credentials — and that's the only variable you have to change.

`BIND_ADDR`'s default of `0.0.0.0:38081` binds every network interface on the
machine, not just loopback. On a workstation that mostly means "reachable from
your LAN"; set `BIND_ADDR=127.0.0.1:38081` if you want the API reachable only
from the same machine, for example when something else (a reverse proxy) is
meant to be the actual network-facing listener.

`WEB_ORIGIN` and `API_ORIGIN` matter together: if you serve the web app from
somewhere other than `http://localhost:38080`, set `WEB_ORIGIN` to that origin
or the browser's CORS preflight fails. If you serve the API from somewhere
other than `http://localhost:38081`, set `API_ORIGIN` to match, or minted
tokens carry the wrong audience and every request they're used on is
rejected — `token::validate` in `src/auth/token.rs` checks the token's
`resource` against `API_ORIGIN` on every call.

## The clients

| Variable | Default | Read in | Purpose |
|---|---|---|---|
| `OPENBOOKS_API` | `http://localhost:38081` | `openbooks-desktop/src/client.rs`, `openbooks-cli/src/main.rs` | base URL the desktop client and the CLI use for every API request |
| `NUXT_PUBLIC_API_BASE` | `http://localhost:38081` | `openbooks-web/nuxt.config.ts` | base URL the web app's browser code uses for every API request |
| `OPENBOOKS_TOKEN` | none | `openbooks-cli/src/api.rs`, `openbooks-desktop/src/client.rs` | the bearer token attached to every request; empty or unset means unauthenticated |

Point any client at a non-default host by setting its base-URL variable
before running it:

```sh
OPENBOOKS_API=http://box:38081 just cli
OPENBOOKS_API=http://box:38081 just desktop
NUXT_PUBLIC_API_BASE=http://box:38081 npm run dev   # from openbooks-web/
```

See [Pointing the clients at your server](/openbooks-docs/server/clients/) for
the full picture, and
[Users and tokens](/openbooks-docs/server/users-and-tokens/) for how
`OPENBOOKS_TOKEN` gets minted in the first place.

Two more variables exist but aren't about finding a server: `openbooks-desktop`
reads `OPENBOOKS_VIEW` and `OPENBOOKS_SHOT` to render one screen headless and
write it to a PNG, for checking a layout without opening a window (see the
desktop docs), and `openbooks-cli` reads `NO_COLOR` (as `env_os`, so only its
presence matters, not its value) to turn off colored output.

## Port map

| Service | Port |
|---|---|
| Web UI | 38080 |
| API | 38081 |
| Docs site | 38082 |
| Postgres | 38083 |

All four sit below the OS's ephemeral range and aren't claimed by anything in
`/etc/services`, so several projects can run at once on the same machine
without colliding. `just run` and `just docs` refuse to start rather than
silently landing on a different port if one of these is already taken.
