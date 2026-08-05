---
title: Pointing the clients at your server
description: How the web app, desktop client, and CLI each find the API, and how to point them at a non-default host.
sidebar:
  order: 5
---

All three clients default to an API on the same machine, at
`http://localhost:38081`. Running your own server usually means overriding
that once, per client, with an environment variable.

## Web app

`openbooks-web` reads the API base URL from `NUXT_PUBLIC_API_BASE`
(`openbooks-web/nuxt.config.ts`), exposed to the browser through Nuxt's
`runtimeConfig.public.apiBase`:

```sh
NUXT_PUBLIC_API_BASE=http://box:38081 npm run dev
```

Since it's a public runtime config value, this has to be set wherever the
Nuxt process runs — the browser reads the value that got baked in at build or
start time, not anything set on the machine viewing the page.

## Desktop client

`openbooks-desktop` has a **Settings** screen for this — type the address,
press **Save and reconnect**, and it's remembered on that computer. Until
something is saved there, it reads `OPENBOOKS_API`
(`openbooks-desktop/src/client.rs`, `base_url()`):

```sh
OPENBOOKS_API=http://box:38081 just desktop
```

or, running `cargo run` directly from `openbooks-desktop/`:

```sh
OPENBOOKS_API=http://box:38081 cargo run
```

A saved address wins over the variable, so setting it on a machine that's
already been pointed somewhere in Settings has no effect.

## CLI

`openbooks-cli` reads the same variable, `OPENBOOKS_API`, wired through clap
as the `--api` flag's environment source (`openbooks-cli/src/main.rs`):

```sh
OPENBOOKS_API=http://box:38081 just cli
```

or pass it explicitly instead of through the environment:

```sh
just cli --api http://box:38081 balances
```

## Authentication travels separately

None of these variables carry a credential — they only say where the API is.
The web app still needs a browser session from signing in at that host's
`/auth/login`; the desktop client and CLI still need `OPENBOOKS_TOKEN` set to
a token minted for that same server. See
[Users and tokens](/openbooks-docs/server/users-and-tokens/) for minting one,
and [Configuration](/openbooks-docs/server/configuration/) for the full
variable table.
