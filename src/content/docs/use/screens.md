---
title: Screens
description: A walkthrough of every route in openbooks-web, what a user does there, and which API calls it makes.
sidebar:
  order: 3
---

Six routes, defined by the files in `openbooks-web/app/pages/`. The sidebar in
`openbooks-web/app/components/ObSidebar.vue` links to five of them under
plain-English labels; the sixth is reached by clicking an account.

The sidebar is more than navigation — it carries the live balances (each asset
account, the total on hand, and anything still owed), so the numbers a treasurer
checks most often are on screen whatever route they're on. Account names in it link
to the drill-down.

Below `lg` the rail collapses behind a 44×44 menu button in a sticky top bar that also
shows what's on hand and a **Record** button straight to `/record` — recording is the
most frequent act on a phone, and it should not require scrolling past a statement to
reach. The rail is a disclosure rather than a modal: opening it moves focus to the
first section, and Escape closes it and returns focus to the button that opened it.

Touch targets meet the 44px floor under `@media (pointer: coarse)` rather than at a
breakpoint, so a touchscreen laptop gets them at any width while a mouse keeps the
denser desktop spacing.

The rail's footer carries the theme control, who is signed in, and **Sign out**. Those
last two used to be a full-width strip above every page, which spent a row of vertical
space right-aligning two items and stacked a second chrome bar on a phone.

## Overview (`/`)

File: `openbooks-web/app/pages/index.vue`.

The home screen *is* the period statement, rather than a grid of summary tiles. Top
to bottom:

1. **A period picker and a link to print** — month, quarter, or year, plus which one.
   The choice is kept in the URL, as on the statements route, so a period can be
   bookmarked, sent to someone, survives a reload, and Back undoes a change to it.
2. **Three figures** — money in, money out, and what's left over. The two bars are
   proportions of the pair *together*, so a full bar means all of the period's
   movement went one way; scaled against the larger figure instead, the bigger one
   would draw a full bar every period and say nothing. The third figure flips to
   "Short by" when more went out than came in.
3. **The statement** — "Where it came from" and "What it went to" with their
   subtotals, rendered on screen exactly as it prints, closing on a heavier rule
   above the left-over line.
4. **A rail** — money in and out by month, then the four most recent entries. The
   chart follows the period picker rather than the clock: a year shows its twelve
   months, a quarter its three, and a month keeps a trailing year because one bar is
   not a trend. Its subtitle always names the literal window ("Jul – Sep 2026"), so
   the bars can never be read as a period they don't cover. Latest stays genuinely
   latest — one request covers whichever window starts earlier.
5. **The record bar** — docked across the bottom edge at desktop width so recording
   never costs a navigation. Below `lg` it becomes an ordinary section at the end of
   the page instead, because a fixed bar tall enough for six stacked fields would
   swallow a phone screen. The page reserves the docked bar's *measured* height plus a
   gap, so a two-line error message grows the bar and the reservation together instead
   of letting it cover the closing figure.

Printing this route is not the intended path — **Print statement** goes to
[Statements](#statements-statements), which carries the balance sheet — but people press
Cmd-P on the page in front of them, so the overview has its own running head and paper
masthead. Whatever comes out of the printer says what it is, which period it covers,
when it was printed, and where the full statement lives.

A brand-new book gets a designed first-run panel here instead of a screen of zeroes.
See [Reports](/openbooks-docs/use/statements/#first-run) for what it shows and why.

When the figures can't be fetched — the API restarting, a dropped connection — the
three figures read `—` and "figures not in yet" rather than `$0.00`, and the statement
says which period it couldn't add up and offers **Try again**. A zero is a claim about
your books; a dash is not, and the difference matters when the next step is printing
the page for a meeting.

API calls on load: `GET /accounts`, `GET /reports/balances`,
`GET /reports/income-statement` for the chosen period, and `GET /transactions` for
the trailing twelve months (which feeds both the trend and the recent list, so it is
one request, not two). Recording calls `POST /transactions` then refreshes.

## Record money (`/record`)

File: `openbooks-web/app/pages/record.vue`.

The same record component the overview docks, on its own route: this is the phone
path, and what a bookmark or a deep link points at. Rendered stacked rather than as
a bar.

## Activity (`/activity`)

File: `openbooks-web/app/pages/activity.vue`.

Every entry, newest first, at the density a real set of books reaches. Above the
table are a free-text search and four date presets — This month, This quarter, Year
to date, All time.

The date preset is what goes to the server; the search filters what came back, over
both descriptions and account names, so typing doesn't fire a request per keystroke.
At desktop width the table owns its own scroll and the header stays put, which is
what keeps it readable at hundreds of rows.

Each row shows the date, description, a "where it moved" summary built client-side as
`"<destination> ← <source>"`, the amount, and Edit / Delete. Delete opens a
confirmation naming the entry and its amount; Edit opens the edit dialog described in
[Recording money](/openbooks-docs/use/recording-money/#editing-an-entry).

API calls: `GET /transactions` with the preset's `from` (`api.transactions()`),
re-run when the preset changes. Delete calls `DELETE /transactions/:id`.

## Statements (`/statements`)

File: `openbooks-web/app/pages/statements.vue`.

The handout. Same period picker as the overview, plus a Print button, and both
statements for that period: what came in and went out, then what's held and owed.
Everything here is built to leave the screen — see
[Reports](/openbooks-docs/use/statements/) for the tables and the print behaviour.

API calls: `GET /reports/income-statement` with `from`/`to` and
`GET /reports/balance-sheet` with `as_of` set to the period's end date. Both re-run
when the period changes.

## Categories (`/categories`)

File: `openbooks-web/app/pages/categories.vue`.

Where accounts get created and reviewed. A form adds one with a plain-English name
and a "what kind" dropdown (labelled "Where money sits", "Where money comes from",
"What money is spent on", "What we owe", "Starting balances" — see
[Overview](/openbooks-docs/dev/web/) for why). Two of those labels come from the
club/personal skin so a household never reads "we". Duplicate names are rejected
client-side before the request goes out.

Below the form, one card per kind lists the accounts in it with their balances, or
"None yet". Names under the two countable kinds link to the drill-down.

API calls: `GET /accounts` and `GET /reports/balances` on load; the form calls
`POST /accounts` and refetches.

## One account (`/accounts/:id`)

File: `openbooks-web/app/pages/accounts/[id].vue`.

What one account holds now, and every entry that got it there with a running balance.
The API has no per-account endpoint, so this fetches all transactions and filters
client-side, accumulating the running total forward from the oldest entry; the
current balance shown above the table comes from `GET /reports/balances`, which is
the API's own figure rather than a re-derived one.

Rows show the date, description, the other side of the entry, the change to this
account, and the running balance. For income, liability, and equity accounts a note
explains that the figures read the way the statements present them rather than the
way they're stored.

API calls: `GET /transactions` with no range, plus the shared `GET /accounts` and
`GET /reports/balances`. An unknown id renders a "No such account" state rather than
an error.

## Device (`/device`)

File: `openbooks-web/app/pages/device.vue`.

Not in the sidebar. This is where a person types the code shown to them on
some *other* device — a CLI over SSH, or anything else with no browser of
its own — to approve that device signing in. See
[the device grant](/openbooks-docs/dev/auth/#the-device-grant-rfc-8628) for
the protocol underneath.

Reached two ways: with a code already filled in
(`?user_code=ABCD-EFGH`, from `verification_uri_complete` when the other
device could open a browser itself), which looks the code up immediately; or
blank, for someone typing a code they were shown on a screen with no
browser at all.

**A code can be entered in any case, with or without the dash.** The field
never reformats what's typed — a person copying `abcd-efgh` off a terminal
onto a phone shouldn't have to match the server's own `ABCD-EFGH` casing —
and the API normalises it (`device::normalise`) before the lookup.

Once the code resolves, the page shows the same "is asking to use your
books" sentence the `/authorize` page does, the same
[dynamic-client warning](#consent-authorize) when the client is dynamic and
has never completed a grant, and one warning specific to this page:

> Only enter a code that software running on your own machine showed you,
> just now. If somebody sent you this code — in a message, an email, or
> over the phone — close this page.

Device-code phishing runs backwards from what people expect: the attacker
starts the flow and asks the victim to enter the *attacker's* code, so the
danger isn't who's asking, it's where the code came from — which is exactly
what this warning names.

Choosing **Allow** or **Don't allow** calls `POST /oauth/device/approve` and
shows a confirmation in place — there's nothing to redirect to here, since
the device waiting on the other end finds out by polling
`POST /oauth/token`, not by this page sending it anywhere.

## Consent (`/authorize`)

File: `openbooks-web/app/pages/authorize.vue`.

Not in the sidebar and not reached by navigating the app — this page only
appears when the API's `GET /oauth/authorize` redirects a signed-in browser
here, which happens when `openbooks-cli auth login` (or any other OAuth
client) opens one. Nothing about it is reachable by clicking around inside
OpenBooks.

It shows the client's registered display name — read from the API via
`GET /oauth/client_info`, never from the query string, so a crafted link
can't put a flattering name in front of the person approving it — and one
sentence of consequence:

> **openbooks-cli** is asking to use your books. If you allow it, it can
> read and change everything you can — there are no partial permissions
> here.

That sentence is literal, not a simplification for the reader: there is no
scope system anywhere in OpenBooks, so **Allow** grants exactly the same
total access any signed-in user already has, nothing narrower.

When the client is dynamically registered (see
[Dynamic client registration](/openbooks-docs/dev/auth/#dynamic-client-registration-rfc-7591))
and has never completed a grant, the page adds a second warning
(`ObUnknownClient.vue`) naming that plainly: it registered itself rather
than shipping with OpenBooks, and the display name above is whatever it
called itself. Given anonymous registration and no RBAC, that warning — not
the display name — is the real backstop.

**Don't allow** sends the browser back to the client with
`error=access_denied` and no code. Choosing either calls
`POST /oauth/authorize/approve`, which
requires the full cookie session this page's own middleware already
demanded to get here, and the response tells the page where to send the
browser next — a loopback address on the same machine, not a page inside
this app, so the navigation is a real `window.location.href` assignment
rather than a router push.

Reaching this page at all requires having signed in with both factors
already — see [Authentication](/openbooks-docs/dev/auth/) for the OAuth
protocol behind it, and the sign-in flow itself.
