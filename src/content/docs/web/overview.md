---
title: Overview
description: What openbooks-web is, the stack, how to run it, and the no-accounting-vocabulary rule.
sidebar:
  order: 1
---

`openbooks-web` is the Nuxt UI for `openbooks-api`. It's what a family or club
treasurer actually opens: a home screen that *is* the period statement, a docked bar
to record money in, money out, and transfers, a searchable register of everything
recorded, printable statements, a per-account drill-down, and a place to manage
categories. Source lives in `openbooks-web/app/`.

## The stack

- [Nuxt 4](https://nuxt.com/) on [Vue 3](https://vuejs.org/), rendered client-side
  only. `openbooks-web/nuxt.config.ts` sets `ssr: false`, with the reasoning left in
  a comment there: this is a browser-only admin screen talking straight to the API,
  and turning SSR on would mean the API also needs to be reachable from the Nuxt
  server process, not just the browser.
- [Tailwind CSS v4](https://tailwindcss.com/) via the `@tailwindcss/vite` plugin.
  There is no `tailwind.config.js` — v4 is CSS-first, so the design tokens live in
  `openbooks-web/app/assets/css/main.css` under `@theme inline`.
- No component library and no state management library. Interactive primitives are
  native wherever one exists: `<select>`, `<input type="date">`, and `<dialog>` with
  `showModal()` for the confirm and edit flows, which brings focus trapping, Escape,
  and the top layer for free.

### The typeface is vendored

[Public Sans](https://public-sans.digital.gov/) (SIL OFL) is served from
`openbooks-web/public/fonts/PublicSans-Variable.woff2` — self-hosted, never a
third-party CDN, and preloaded from `nuxt.config.ts`. It is the US Web Design
System's face, drawn for public-facing government documents, which is what a
treasurer's report handed round a table is. It also carries real tabular figures,
which the statement columns depend on. The licence ships beside it as
`PublicSans-LICENSE.txt`.

## Running it

Use `just` from the repo root:

```sh
just run      # starts postgres, api, and web in the background
just seed     # loads sample data worth looking at
```

Once it's up, the dev server is at [http://localhost:38080](http://localhost:38080).
`just run` installs `openbooks-web` dependencies on first run if `node_modules` isn't
there yet, and it waits for the API (and the Postgres it depends on) to come up
first.

To run the web app directly instead of through `just`:

```sh
cd openbooks-web
npm install
npm run dev            # http://localhost:38080
npm test               # the money-path assertions
```

## Talking to the API

Every request goes through the `useApi()` composable in
`openbooks-web/app/composables/useApi.ts`. It reads the API's base URL from Nuxt
runtime config:

```ts
// openbooks-web/nuxt.config.ts
runtimeConfig: {
  public: {
    apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:38081',
  },
},
```

Set `NUXT_PUBLIC_API_BASE` to point the web app at an API running somewhere other
than `localhost:38081`. `useApi()` wraps `$fetch` with that base URL and exposes one
function per endpoint (`accounts()`, `balances()`, `transactions()`,
`createTransaction()`, `replaceTransaction()`, `incomeStatement()`,
`balanceSheet()`, and so on). Pages call these functions rather than building URLs
themselves.

## Light, dark, and paper

The interface follows the system colour scheme and takes a manual override, cycled
from the button at the bottom of the sidebar (`system → light → dark → system`). The
choice persists in `localStorage` under `openbooks:theme`; the resolved value is
written to `data-theme` on `<html>`, which is what the CSS switches on.

Print is a third treatment, not a variant of either. The `@media print` block in
`main.css` resets the colour tokens to black-on-white regardless of what the screen
is wearing, because a statement is a deliverable and dark-mode ink would waste toner
and read badly on paper.

## Club or personal

A switch at the top of the sidebar chooses between **Club** and **Personal**. It is
a skin and nothing else: it changes wording and one initial default (clubs land on
the quarter, because meetings are quarterly; households land on the month). It never
changes routes, capabilities, validation, or stored data, so an instance can flip it
back and forth with no consequence. The whole vocabulary lives in
`openbooks-web/app/composables/useSkin.ts`.

## No accounting vocabulary in the UI

This is a hard rule, not a style preference: nobody using this app should have to
know what a debit or a credit is. A user picks an amount, an account ("where money
sits"), and a category ("where from" or "what for") — the web layer composes the
balanced two-legged transaction the ledger requires.

That translation lives in exactly one place, `legsFor()` in
`openbooks-web/app/composables/useLedger.ts`, so the docked record bar, the record
route, and the edit dialog cannot drift apart:

```ts
// Debit is positive, credit is negative, and the pair always sums to zero.
// Money in grows the account it landed in; money out and transfers grow the
// other side — an expense category, or the destination account.
const [debit, credit] = mode === 'in' ? [accountId, categoryId] : [categoryId, accountId]
```

The same substitution shows up everywhere else: account kinds are labelled "Where
money sits" / "Where money comes from" / "What money is spent on" / "What we owe" /
"Starting balances" instead of asset/income/expense/liability/equity (see
`openbooks-web/app/pages/categories.vue`), and the balance sheet is titled "What we
have and what we owe" (see `openbooks-web/app/pages/statements.vue`). If you add a
screen or a field, keep following that pattern rather than reintroducing accounting
terms.

## Money is integer cents

`toCents()` in `openbooks-web/app/composables/useMoney.ts` parses typed dollars with
string arithmetic rather than a float — `19.99 * 100` is `1998.9999999999998` in
IEEE 754 — and refuses anything carrying more precision than a cent instead of
quietly rounding it. `openbooks-web/test/money.test.ts` covers that and the
money-direction reasoning; run it with `npm test`.

:::note
Signing in is required — `app/middleware/auth.global.ts` redirects anywhere but
`/login` to the sign-in page until a session cookie resolves. See
[Authentication](/openbooks-docs/api/auth/) for the credential and what it does and
doesn't protect against.
:::
