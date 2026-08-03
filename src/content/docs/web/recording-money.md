---
title: Recording money
description: How to record money in, money out, and transfers, and what each field does behind the scenes.
sidebar:
  order: 3
---

Everything you record goes through one form, on the Dashboard (`/`), in
`openbooks-web/app/pages/index.vue`. Three tabs change what the form's two account
dropdowns mean; the fields themselves stay the same.

## The three tabs

### Money in

Use this when the club receives money: dues, a donation, bake sale proceeds.

- **Date** — when it happened.
- **Amount** — a positive dollar amount, e.g. `25.00`.
- **Deposit into** — which asset account ("where money sits") received it. If
  there's only one asset account, the app picks it for you automatically.
- **Category (where it came from)** — an income account. This is the label shown for
  the second dropdown in this tab specifically.
- **Description** — a short note, e.g. "March dues — Smith family".

### Money out

Use this when the club spends money: food, supplies, a bill.

- **Paid from** — which asset account the money left. This replaces "Deposit into"
  as the label on the first dropdown.
- **Category (what it was for)** — an expense account.
- The rest of the fields (date, amount, description) work the same as Money in.

### Transfer

Use this when money moves between two of the club's own accounts — say, from
checking into a savings account.

- **Paid from** — the source asset account.
- **To account** — the destination asset account. The dropdown excludes whichever
  account is already selected as the source, so you can't transfer an account into
  itself.

## What happens when you hit Record

The form never asks for a debit or a credit. Internally, `index.vue` turns your two
account choices and one amount into the two-legged, zero-sum transaction the ledger
requires:

```ts
// Debit is positive, credit is negative, and the pair always sums to zero.
// Money in grows the bank account; money out and transfers grow the other
// side (an expense category, or the destination account) instead.
const [debit, credit] =
  mode.value === 'in' ? [form.account, form.category] : [form.category, form.account]
```

For **Money in**, the asset account is debited (grows) and the income category is
credited. For **Money out** and **Transfer**, the category or destination account is
debited and the asset account you paid from is credited. Either way, this produces
exactly two entries — `+cents` on one account, `-cents` on the other — sent as a
single `POST /transactions` call (`api.createTransaction()` in
`openbooks-web/app/composables/useApi.ts`).

Amounts you type as dollars (e.g. `19.99`) are converted to integer cents before
they're sent, using `toCents()` in `openbooks-web/app/composables/useMoney.ts`. It
rounds rather than truncates, because floating-point multiplication can land on
`1998.9999...` instead of `1999`, and it rejects zero or negative amounts.

## Validation

Before submitting, the form checks:

- the amount converts to a positive number of cents,
- the description isn't blank,
- both accounts are selected.

Anything the API itself rejects — for instance, entries that don't sum to zero —
comes back as an error message pulled out of the response and shown above the form
(`errorText()` in `useApi.ts`).

## Deleting a transaction

On the History screen (`/transactions`), every row has a `Delete` link. It asks for
confirmation, then calls `DELETE /transactions/:id`. There's no edit — to fix a
mistake, delete the transaction and record it again.
