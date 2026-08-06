---
title: Sample data
description: What just seed loads, the window it covers, and why it's deterministic and idempotent.
sidebar:
  order: 6
---

```sh
just seed
```

runs `openbooks-api/seed.sh` against a running API, posting a club's worth of
plausible activity so the monthly, quarterly, and annual reports all have
something to show rather than rendering all zeros.

## What it posts

Roughly 80 transactions spanning **2025-01 through 2026-07** — two full years
to compare and eight quarters, plus enough categories to make a statement
read like a real club's books:

- **Monthly**, every month in the window: member dues (drifting up over time,
  as though members were joining), hall rent, and meeting refreshments.
- **A few times a year**: a bake sale, a raffle, a plant sale, a car wash —
  fundraising income — and donations, both a named local-business donation
  and an anonymous one.
- **One-off expenses**: printer paper, a museum trip, an aquarium trip, a
  science center trip, annual liability insurance, picnic and holiday-party
  supplies, bank service charges.
- **A liability, worked down partway**: `Unpaid Bills` gets an invoice for
  trophies (`Supplies` debited, `Unpaid Bills` credited) and then a partial
  payment against it, so the balance sheet's "what we owe" section has
  something in it and shows a liability being paid down rather than sitting
  untouched.
- **A transfer with no income or expense category on either side**: cash
  moved from the cash box into checking, twice — once in each year.

The script also creates two accounts the base chart of accounts doesn't ship
with (`openbooks-api/migrations/0002_seed_accounts.sql` has none): `Unpaid
Bills` (liability) and `Field Trips` and `Insurance` (expense) — via
`ensure_account`, which checks for an existing account of that name before
creating it.

## Two users, so attribution has something to show

`script-auth.sh` creates a second account, `treasurer@example.com`, alongside
the usual `demo@example.com`. `seed.sh` mints a token for it and posts a
handful of the transactions above — two donations and a bank charge, not new
activity — with that token instead of the primary one, so the two names
appear side by side under "who recorded it" on the Activity page. The amounts
and dates are unchanged; only which account posted them differs, so the
report totals do not move.

**Every seeded transaction has an author**, one of those two. There is no
unattributed sample row, and there can't be: every path that writes a
transaction now authenticates, so a null `created_by` is only reachable by a
row posted before phase 5 or one whose author has since been removed with
`user rm`.

## Two token states, for Connected programs

`seed.sh` also mints a live labelled token (`demo terminal`) and a second one
(`demo revoked`) that it immediately revokes through `POST /oauth/revoke`.
Settings → Connected programs lists the live one. The revoked one never
appears there — that list is what is currently live — so instead the script
prints a ready-to-run command that calls the API with the revoked token, to
demonstrate the call being refused rather than the row being shown.

This corner of the script is **not idempotent** in the way the rest of it is:
re-running `just seed` mints a new labelled pair rather than replacing the
old one, because clearing tokens by label needs either a `psql` session (not
on this machine's `PATH` — Postgres runs in the container) or a session this
script doesn't have. The labels make the accumulation visible in Connected
programs, and the phase 5 reaper collects expired tokens on its own. This was
a deliberate trade-off, not an oversight — everything else the script does
stays deterministic and idempotent.

## Deterministic

No randomness and no value derived from the current date. Dues amounts, dates,
and descriptions are all fixed in the script, so the numbers a report shows
are the same on every run — which is what makes reports comparable between
runs and reviewable in a diff.

## Idempotent

Before posting anything, the script deletes every transaction it finds dated
between 2025-01-01 and 2026-12-31, then reposts the full set. Running
`just seed` a second time replaces what it posted before rather than doubling
it.

## Through the API, not SQL

`seed.sh` is a `curl` script, not a `psql` script — every account and
transaction goes through the same HTTP endpoints and the same validation a
real client would hit. If an endpoint regresses in a way that would reject a
legitimate post, `just seed` fails loudly instead of quietly inserting data
that bypassed the checks the API is supposed to enforce.

It authenticates the same way any non-web client does: `script-auth.sh`
ensures a `demo@example.com` user exists, mints a bearer token for it with
`openbooks-api mint-token`, and exports it as an `${AUTH[@]}` array of curl
arguments that every `curl` call in `seed.sh` includes. See
[Users and tokens](/openbooks-docs/server/users-and-tokens/) for what minting
a token actually does.

## 2099 belongs to `smoke.sh`

`just smoke` (`openbooks-api/smoke.sh`) runs its end-to-end check against the
year 2099, and deletes everything it finds there when it's done. `seed.sh`
never touches that year — leave it alone in any sample data of your own, so
the two scripts don't collide.
