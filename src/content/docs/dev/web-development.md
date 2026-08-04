---
title: Web app development
description: Running the dev server, logs, just recipes, project layout, and conventions for contributors.
sidebar:
  order: 11
---

## Running the dev server

From the repo root, use `just`:

```sh
just run       # starts postgres, api, and web in the background
just seed      # loads sample data worth looking at
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
npm test        # money-path assertions, no framework
```

Set `NUXT_PUBLIC_API_BASE` first if the API isn't at the default
`http://localhost:38081`.

## Project layout

```
openbooks-web/
  app/
    app.vue                  # shell: skip link, sidebar, page slot
    error.vue                # 404 / error page, inside the design system
    assets/css/main.css      # tokens, base, motion, print
    pages/                   # one file per route (file-based routing)
      index.vue              # Overview — the period statement
      record.vue             # Record money
      activity.vue           # the register
      statements.vue         # the printable handout
      categories.vue         # chart of accounts
      settings.vue           # club or personal
      accounts/[id].vue      # one account, with a running balance
    components/              # Ob*.vue, auto-imported by Nuxt
    composables/
      useApi.ts              # typed wrapper around every API call, + errorText()
      useLedger.ts           # shared read model + legsFor(), the two-legged rule
      useMoney.ts            # money(), amount(), signed(), toCents()
      usePeriod.ts           # month / quarter / year, and the URL sync
      useSkin.ts             # club or personal wording
      useTheme.ts            # light / dark / system
  server/plugins/            # direction-contract.ts injects the design contract
  public/fonts/              # vendored Public Sans + its licence
  test/money.test.ts         # run with `npm test`
  nuxt.config.ts             # ssr: false, tailwind, redirects, apiBase
```

Components live in `app/components/` and are auto-imported, so a page never imports
one. They're all prefixed `Ob` to keep them distinct from anything a dependency might
register.

## Conventions

- **No accounting vocabulary in the UI.** See
  [Overview](/openbooks-docs/dev/web/) for the full rule. If you add a field or a
  screen, name it the way a treasurer would talk about it, not the way a ledger would.
- **All money is integer cents** on the wire and in state, converted only at the edges
  (`toCents()` for input, `money()`/`amount()`/`signed()` for display) in
  `openbooks-web/app/composables/useMoney.ts`. `toCents()` uses **string arithmetic,
  not a float** — don't reintroduce one, and keep `npm test` passing.
- **The two-legged rule lives in one function.** `legsFor()` in `useLedger.ts` is the
  only place that turns a mode plus two accounts into a debit and a credit. The docked
  record bar, the `/record` route, and the edit dialog all call it.
- **All API access goes through `useApi()`.** Don't call `$fetch` from a page; add a
  function there so the base URL and typing stay in one place.
- **Styling is Tailwind v4 plus a token layer.** There is no `tailwind.config.js` —
  the semantic tokens (`surface`, `ink`, `ink-muted`, `line`, `accent`, `in`, `out`,
  and so on) are declared in `app/assets/css/main.css` under `@theme inline`, backed by
  `--ob-*` custom properties that swap for dark mode. Use the semantic names rather
  than raw palette values, so light, dark, and print all keep working.
  - Text tokens are chosen to clear 4.5:1 on `surface`, `canvas` **and** `sunken`. If
    you add a colour, check it against all three before using it for copy.
  - `--ob-out-ink` exists because white on the dark theme's salmon `--ob-out` is
    unreadable; use it for any ink on a danger surface.
- **No component library.** Native elements where one exists: `<select>`,
  `<input type="date">`, and `<dialog>` + `showModal()` for the confirm and edit
  flows, which gives focus trapping, Escape, and the top layer without a dependency.
  Note that Tailwind's preflight zeroes `margin`, which defeats a native dialog's
  `margin: auto` centring — the dialogs set `m-auto` back explicitly.
- **Icons are drawn, not imported.** `ObIcon.vue` holds every glyph on one geometry:
  24-unit box, 1.6 stroke, round caps and joins. Adding an icon means drawing it to
  that system. No emoji, no second icon set.
- **The typeface is vendored.** Public Sans in `public/fonts/`, never a CDN.
- **SSR is off** (`ssr: false`). This is a browser-only admin screen that talks
  straight to the API. One consequence to respect: because nothing is server-rendered,
  the theme is stamped onto `<html>` by a small blocking script in `nuxt.config.ts`
  before the bundle boots — without it every cold load flashes light at a dark-mode
  user.
- **The design direction is recorded in the markup.** `server/plugins/direction-contract.ts`
  injects an HTML comment as the first child of `<body>`. It states what this surface
  is and what it refuses; read it before making a visual change, and update it if the
  direction genuinely changes.

## After changing anything that touches money in or out

Run `npm test` in `openbooks-web`, and `just smoke` from the repo root. The smoke test
exercises the ledger end to end (it needs `jq`) and will fail loudly if something about
balances or reports has regressed, including changes that only look like they're
confined to the UI.
