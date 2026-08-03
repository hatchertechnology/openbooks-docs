---
title: Overview
description: What openbooks-web is, the stack, how to run it, and the no-accounting-vocabulary rule.
sidebar:
  order: 1
---

`openbooks-web` is the Nuxt UI for `openbooks-api`. It's what a family or club
treasurer actually opens: a dashboard to record money in, money out, and transfers,
a history of everything recorded, printable reports, and a place to manage
categories. Source lives in `openbooks-web/app/`.

The stack is [Nuxt 4](https://nuxt.com/) on [Vue 3](https://vuejs.org/), rendered
client-side only. `openbooks-web/nuxt.config.ts` sets `ssr: false`, with the reasoning
left in a comment there: this is a browser-only admin screen talking straight to the
API, and turning SSR on would mean the API also needs to be reachable from the
Nuxt server process, not just the browser. There's no state management library and
no UI component library — four pages, plain `<table>` and `<form>` elements, and CSS
in `openbooks-web/app/app.vue`.

## Running it

Use `just` from the repo root:

```sh
just run      # starts postgres, api, and web in the background
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
`createTransaction()`, `incomeStatement()`, `balanceSheet()`, and so on). Pages call
these functions rather than building URLs themselves.

## No accounting vocabulary in the UI

This is a hard rule, not a style preference: nobody using this app should have to
know what a debit or a credit is. A user picks an amount, an account ("where money
sits"), and a category ("where it came from" or "what it was for") — the web layer
composes the balanced two-legged transaction the ledger requires.

The clearest example is in `openbooks-web/app/pages/index.vue`. The form collects a
plain amount and two plain choices, and this comment above the save logic explains
the translation:

```ts
// Debit is positive, credit is negative, and the pair always sums to zero.
// Money in grows the bank account; money out and transfers grow the other
// side (an expense category, or the destination account) instead.
const [debit, credit] =
  mode.value === 'in' ? [form.account, form.category] : [form.category, form.account]
```

The same substitution shows up everywhere else in the UI: accounts are labelled
"Where money sits" / "Where money comes from" / "What money is spent on" / "What we
owe" / "Starting balances" instead of asset/income/expense/liability/equity (see
`openbooks-web/app/pages/accounts.vue`), and the balance sheet is titled "What we
hold and owe" instead of "Balance Sheet" (see
`openbooks-web/app/pages/reports.vue`). If you add a screen or a field, keep
following that pattern rather than reintroducing accounting terms.

:::note
There's no auth and no login screen. Anyone who can reach the page can edit the
books — deliberate for this POC, not a gap to fix unless asked.
:::
