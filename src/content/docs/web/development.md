---
title: Development
description: Running the dev server, logs, just recipes, project layout, and conventions for contributors.
sidebar:
  order: 5
---

## Running the dev server

From the repo root, use `just`:

```sh
just run       # starts postgres, api, and web in the background
just status    # check what's up
just logs      # follow both api and web logs
just stop      # stop all three
just restart   # stop then start; recorded data survives
```

`just run` installs `openbooks-web`'s dependencies on first run
(`npm install`, if `node_modules` isn't there yet), then starts `npm run dev` in the
background. It waits for the API and Postgres to be up first, since the web app has
nothing to talk to otherwise.

The dev server listens on [http://localhost:38080](http://localhost:38080).

### Logs

The web dev server runs in the background, so nothing prints to your terminal.
Output goes to `.dev/web.log` at the repo root (the API's goes to `.dev/api.log`).
Read it directly when something's not working, or use `just logs` to follow both at
once. `.dev/web.pid` holds the process id; both files are gitignored.

### Running it without `just`

```sh
cd openbooks-web
npm install
npm run dev
```

Set `NUXT_PUBLIC_API_BASE` first if the API isn't at the default
`http://localhost:38081`.

## Project layout

```
openbooks-web/
  app/
    app.vue              # root layout: nav bar + global CSS
    pages/                # one file per route (file-based routing)
      index.vue           # Dashboard
      transactions.vue    # History
      reports.vue         # Reports
      accounts.vue        # Categories
    composables/
      useApi.ts           # typed wrapper around every API call, + errorText()
      useMoney.ts         # money(), toCents(), today()
  nuxt.config.ts          # ssr: false, apiBase runtime config
  package.json
```

There's no `components/` directory yet — each page is small enough to be
self-contained. If a piece of markup starts repeating across pages, that's the
signal to pull it into `app/components/`, which Nuxt will auto-import without any
config.

## Conventions

- **No accounting vocabulary in the UI.** See [Overview](/openbooks-docs/web/overview/) for the
  full rule. If you add a field or a screen, name it the way a treasurer would talk
  about it, not the way a ledger would.
- **All money is integer cents** on the wire and in state, converted to and from
  dollars only at the edges (`toCents()` for user input, `money()` for display), in
  `openbooks-web/app/composables/useMoney.ts`. Don't introduce a float in between.
- **All API access goes through `useApi()`.** Don't call `$fetch` directly from a
  page; add a function to `openbooks-web/app/composables/useApi.ts` instead, so the
  base URL and typing stay in one place.
- **Styling is one global stylesheet**, in the `<style>` block of
  `openbooks-web/app/app.vue`. There's no CSS framework and no scoped
  per-component styles; new markup should reuse the existing classes (`.card`,
  `.row`, `.tabs`, `.hint`, `.error`/`.ok`, `.amount`, `.in`/`.out`) rather than
  inventing new ones.
- **No component library.** Forms use native `<input>`, `<select>`, and `<button>`
  elements — for example `<input type="date">` for date pickers rather than a
  date-picker package.
- **SSR is off** (`ssr: false` in `nuxt.config.ts`). This is a browser-only admin
  screen that talks straight to the API; keeping SSR off means the API only ever
  needs to be reachable from the browser, not from the Nuxt server process too.

## After changing anything that touches money in or out

Run `just smoke` from the repo root. It exercises the ledger end to end (it needs
`jq`) and will fail loudly if something about balances or reports has regressed,
including changes that only look like they're confined to the UI.
