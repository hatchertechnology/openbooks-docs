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
