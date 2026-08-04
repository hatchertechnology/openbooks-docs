---
title: Money is integer cents
description: Why every amount in OpenBooks is an i64 count of cents, and what that means for parsing, formatting, and rounding in a client.
sidebar:
  order: 2
---

Every amount anywhere in OpenBooks — an entry, a report line, a balance — is
an integer count of cents. There is no floating-point representation of money
anywhere in the money path: not in Postgres, not in the API, not in any
client.

## Where this lives in the code

- Postgres: `entries.amount_cents` is `bigint` (`openbooks-api/migrations/0001_init.sql`).
- The API: every Rust struct that carries an amount uses `i64` for
  `amount_cents` (`openbooks-api/src/lib.rs` — `NewEntry`, `Entry`, `Line`,
  and the report structs all agree on this).
- Over the wire: JSON numbers, but always whole cents — `$45.00` is the
  integer `4500`, never `45.00` or `45.0`.

`$1,234.56` is stored, transmitted, and compared as the plain integer
`123456`. There's no decimal point at any layer until something formats a
number for a person to read.

:::note
Why cents and not dollars-as-a-float? Binary floating point can't represent
most decimal fractions exactly. `19.99 * 100.0` comes out to
`1998.9999999999998` in IEEE 754 double precision — round or truncate that
carelessly and you lose or gain a penny per transaction. An `i64` count of
cents has no such problem: addition and subtraction are exact, always.
:::

## What this means if you're writing a client

OpenBooks currently has four clients — the web app, the CLI/TUI, the desktop
app, and the agent plugin — and all four follow the same rule: **parse to
cents on the way in, format from cents on the way out, and never let a float
touch an amount in between.**

### Parsing input

A human types a dollar amount as text — `"45"`, `"45.50"`, `"$1,234.56"`.
That text has to become an exact `i64` count of cents without ever passing
through a float.

`openbooks-cli/src/api.rs` does this with `parse_cents`, which works entirely
in string and integer arithmetic:

```rust
/// Dollars as typed by a human to integer cents, without ever touching a float —
/// `"19.99" * 100.0` is 1998.9999... in binary floating point, and truncating that
/// loses a penny per transaction.
pub fn parse_cents(s: &str) -> Result<i64> {
    let s = s.trim().trim_start_matches('$').replace(',', "");
    let (whole, frac) = match s.split_once('.') {
        Some((w, f)) => (w, f),
        None => (s.as_str(), ""),
    };
    // ...
    let cents: i64 = match frac.len() {
        0 => 0,
        1 => frac.parse::<i64>()? * 10,   // "45.5" means 50 cents, not 5
        _ => frac.parse::<i64>()?,
    };
    let total = whole * 100 + cents;
    // ...
}
```

Notable details worth copying into any new client:

- It strips a leading `$` and thousand separators (`,`) before parsing, so
  `"$1,234.56"` and `"1234.56"` both work.
- A single fractional digit is a count of *tenths* of a dollar, not cents —
  `"45.5"` means `45.50`, i.e. `4550` cents, not `4505`. Get this wrong and
  every amount typed with one decimal place is off by a factor of ten.
- More than two fractional digits, or non-digit characters, is rejected
  outright rather than truncated or rounded — there's no valid amount of
  money with a third decimal place.
- The whole computation — splitting on `.`, parsing `whole` and `frac`
  separately, then `whole * 100 + cents` — stays in integers throughout.
  Nothing here is ever cast to `f64`.

### Formatting output

Going the other direction, `money()` in the same file turns a cents value
back into something a person reads as currency, again without floats:

```rust
/// Cents to `$1,234.56`, with a thousands separator so a five-figure balance is
/// readable at a glance.
pub fn money(cents: i64) -> String {
    let neg = cents < 0;
    let abs = cents.unsigned_abs();
    let (dollars, rem) = (abs / 100, abs % 100);
    // ... groups `dollars` with commas, then:
    format!("{}${grouped}.{rem:02}", if neg { "-" } else { "" })
}
```

`dollars` and `rem` (cents left over, `0`–`99`) come from integer division
and remainder — `abs / 100` and `abs % 100` — not from dividing by `100.0`
and formatting with two decimal places. The sign is handled separately by
checking `cents < 0` up front and working with `unsigned_abs()`, so there's
never a `"-$-45.00"` or similar off-by-sign bug.

### Rounding

There shouldn't be any. If every parse step and every arithmetic step in your
client stays in integer cents, there's nothing to round — the numbers you
compute are exact by construction. If you find yourself needing to "round to
the nearest cent" anywhere in a client, that's a sign a float slipped into
the money path somewhere upstream and needs to be found and removed, not a
step to implement.

### Reports already carry the sign you should render

Report endpoints (`/reports/balances`, `/reports/income-statement`,
`/reports/balance-sheet`) return amounts that have already been sign-flipped
by `AccountType::sign()` so they read as a normal person expects — see
[Invariants](/openbooks-docs/dev/invariants/#report-sign-flipping-accounttypesign). A
client should render those numbers exactly as returned, in cents-to-dollars
formatting only. Don't re-derive or re-flip a sign on a report total; that
logic lives in one place in the API on purpose.
