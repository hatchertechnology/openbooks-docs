---
title: Recording money
description: How to record money in, money out, and transfers, what each field does behind the scenes, and how editing works.
sidebar:
  order: 1
---

Everything you record goes through one component,
`openbooks-web/app/components/ObRecordBar.vue`. It is docked across the bottom of the
Overview at desktop width and rendered stacked on the `/record` route — the same
component either way, so the validation and the two-legged composition cannot drift
between them. Three modes change what the form's two account dropdowns mean; the
fields themselves stay the same.

## The three modes

### Money in

Use this when the club receives money: dues, a donation, bake sale proceeds.

- **Date** — when it happened. Defaults to today.
- **Amount** — a positive dollar amount, e.g. `25.00`. This is a text input with
  `inputmode="decimal"`, not `type="number"`, so `1,234.56` and `$42.50` are both
  accepted.
- **Into** — which asset account ("where money sits") received it, prompting "Choose an
  account…". If there's only one asset account, the app picks it for you automatically.
- **Where from** — an income account, prompting "Choose a category…". The two dropdowns
  never share a prompt: side by side they would otherwise both say "Choose…", and
  transposing them posts a balanced entry that is silently wrong.
- **Description** — a short note, e.g. "March dues — Smith family".

### Money out

Use this when the club spends money: food, supplies, a bill.

- **Paid from** — which asset account the money left. This replaces "Into" as the
  label on the first dropdown.
- **What for** — an expense account.
- The rest of the fields work the same as Money in.

### Transfer

Use this when money moves between two of the club's own accounts.

- **Out of** — the source asset account, prompting "Choose an account…".
- **Into** — the destination asset account, prompting "Choose another account…" since
  both sides list accounts here. The dropdown excludes whichever account is already
  selected as the source, and the form refuses a transfer where both sides are the
  same account.

The line beside the mode switch changes too: a transfer is the only entry that moves no
money in or out, so it says so rather than repeating the register's general lead.

After a successful record the amount and description clear but the mode and both
account choices stay put, because the next entry is usually more of the same — and
focus returns to **Amount**, so a stack of receipts is one hand on the keyboard rather
than a mouse trip per entry.

## Keyboard

Wherever the form is on screen — docked on the Overview or stacked on `/record`:

| Key | What it does |
|---|---|
| `R` | Jump to the Amount field and select what's in it |
| `Cmd/Ctrl` + `K` | The same, for anyone whose muscle memory says palette |
| `Cmd/Ctrl` + `Enter` | Record, from whichever field you're in |

`R` is deliberately bare, so it is ignored while you are typing in any field — a
description containing an "r" stays a description.

## What happens when you hit Record

The form never asks for a debit or a credit. `legsFor()` in
`openbooks-web/app/composables/useLedger.ts` turns your two account choices and one
amount into the two-legged, zero-sum transaction the ledger requires:

```ts
// Debit is positive, credit is negative, and the pair always sums to zero.
// Money in grows the account it landed in; money out and transfers grow the
// other side — an expense category, or the destination account.
const [debit, credit] = mode === 'in' ? [accountId, categoryId] : [categoryId, accountId]
return [
  { account_id: debit, amount_cents: cents },
  { account_id: credit, amount_cents: -cents },
]
```

For **Money in**, the asset account is debited (grows) and the income category is
credited. For **Money out** and **Transfer**, the category or destination account is
debited and the asset account you paid from is credited. Either way this produces
exactly two entries — `+cents` on one account, `-cents` on the other — sent as a
single `POST /transactions`.

That function is the only place in the web layer that knows the rule, which is why the
docked bar, the `/record` route, and the edit dialog all call it rather than
reimplementing it.

## Dollars to cents, without floats

Amounts you type are converted to integer cents by `toCents()` in
`openbooks-web/app/composables/useMoney.ts`, using string arithmetic rather than
floating-point multiplication:

```ts
const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(cleaned)
const cents = Number.parseInt(m[1], 10) * 100 + Number.parseInt((m[2] ?? '').padEnd(2, '0'), 10)
```

`19.99 * 100` is `1998.9999999999998` in IEEE 754, and every client in this project is
required to keep floats out of the money path entirely rather than round its way back
out of one. Anything carrying more precision than a cent — `1.234`, or the string form
of `0.1 + 0.2` — is refused rather than quietly rounded.
`openbooks-web/test/money.test.ts` asserts all of this, including that every amount
survives a cents → display → cents round trip. Run it with `npm test`.

## Validation

Both forms carry `novalidate`, so the browser's own "Please fill out this field"
bubble never appears. Every check is the app's own, and every failure lands in the
notice above the fields, where it stays put and is announced to a screen reader:

- a date is chosen — "Pick the date this money moved."
- the amount converts to a positive number of cents — "Enter an amount greater than
  zero, like 42.50."
- the description isn't blank
- both dropdowns are chosen, named the way the current mode names them — in Money in,
  "Choose which account the money landed in, and where it came from."
- a transfer's two sides differ

The `required` attributes stay on the controls so assistive technology still announces
the fields as required; only the browser's error UI is suppressed. Both the docked bar
and the edit dialog read these strings from `fieldWords()` and `VALIDATION` in
`openbooks-web/app/composables/useLedger.ts`, so the two forms cannot drift apart.

Anything the API itself rejects — for instance entries that don't sum to zero, which
Postgres enforces with a deferred constraint trigger — comes back as an error message
pulled out of the response by `errorText()` in `useApi.ts` and shown above the form.
That function keeps the API's own wording, but replaces a transport failure's
`[GET] "http://…": <no response>` with something a treasurer can act on.

## Editing an entry

Every row in [Activity](/openbooks-docs/use/screens/#activity-activity) has an Edit
link, which opens `openbooks-web/app/components/ObEditEntry.vue` in a native
`<dialog>`.

The dialog reads the mode back out of the existing legs — whichever side is an asset
account tells it whether this was money in, money out, or a transfer — and pre-fills
every field, so you correct an entry rather than re-keying it.

The API has no `PUT /transactions/:id`, so saving is a re-post plus a delete. The
order matters and is deliberate:

```ts
// The new entry is created *first* on purpose: if the second call fails the
// user is left with a visible duplicate they can delete, rather than a hole
// where their record used to be. Never reorder these.
const created = await api<{ id: number }>('/transactions', { method: 'POST', body })
await api<void>(`/transactions/${id}`, { method: 'DELETE' })
```

The saved entry therefore has a **new id**. Anything holding onto the old one should
refetch.

Entries with more than two legs were not created by this UI, and rewriting them as a
pair would lose detail, so the dialog says so and offers no save — delete and record
them again instead.

## Deleting an entry

Every Activity row has a Delete link. It opens a confirmation naming the entry, its
amount, and its date, and stating that both sides go and it cannot be undone. Then it
calls `DELETE /transactions/:id`.
