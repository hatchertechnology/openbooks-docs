---
title: Invariants
description: The rules OpenBooks guarantees, and exactly where in the code each one is enforced.
sidebar:
  order: 3
---

OpenBooks makes a small number of promises about the ledger and the UI. This
page states each one plainly and points at the exact line of code that
enforces it, so "the app guarantees X" is always checkable, not just
asserted.

## The balance check is a deferred Postgres constraint trigger, not app code

**The rule:** a transaction's entries must sum to zero in `amount_cents`.
Fewer than two entries, or entries that don't cancel out, is not a valid
transaction.

**Where it's enforced:** a `constraint trigger` in
`openbooks-api/migrations/0001_init.sql`, not in Rust:

```sql
create function assert_balanced() returns trigger as $$
declare
    txn   bigint := coalesce(new.transaction_id, old.transaction_id);
    total bigint;
begin
    select coalesce(sum(amount_cents), 0) into total from entries where transaction_id = txn;
    if total <> 0 then
        raise exception 'unbalanced transaction %: entries sum to % cents, must be 0', txn, total;
    end if;
    return null;
end $$ language plpgsql;

create constraint trigger entries_balanced
    after insert or update or delete on entries
    deferrable initially deferred
    for each row execute function assert_balanced();
```

It's `deferrable initially deferred` on purpose: `create_transaction_data` in
`openbooks-api/src/lib.rs` inserts a transaction's entries one row at a
time inside a single database transaction, so the check can only be
meaningful once every leg has landed — at commit, not after each insert.

This lives in the database, not in application code, so that **no bug in the
API — present or future — can ever write an unbalanced transaction.** Even if
every check in Rust were deleted or broken, Postgres itself refuses the
write. That's the actual guarantee; everything else is convenience on top of
it.

## The API's own check exists only for a friendlier 400

`create_transaction_data` in `openbooks-api/src/lib.rs` also checks the sum
before it even opens a database transaction:

```rust
// The DB trigger is the real gate; this just gives a friendlier message.
let sum: i64 = body.entries.iter().map(|e| e.amount_cents).sum();
if body.entries.len() < 2 || sum != 0 {
    return Err(AppError(
        StatusCode::BAD_REQUEST,
        format!(
            "needs 2+ entries summing to zero (got {} entries summing to {sum})",
            body.entries.len()
        ),
    ));
}
```

This check is redundant with the trigger by design. If it were removed
entirely, invalid transactions would still be rejected — just as a
`500`-ish Postgres error surfaced through `AppError`'s mapping of database
error codes, instead of a clean `400` with a specific message. Don't treat
this Rust-side check as "the" validation and don't let it drift from what the
trigger actually enforces; it's a UX nicety layered on top of the real gate.

## Report sign-flipping: `AccountType::sign()`

**The rule:** reports never show a negative number for a normal balance.
Income, liability, and equity accounts accumulate as *credits* internally
(negative `amount_cents`), but a statement should read them as positive —
nobody wants to see "-$500 in dues" on a report that just means "$500 came
in."

**Where it's enforced:** exactly one function,
`AccountType::sign()` in `openbooks-api/src/lib.rs`:

```rust
impl AccountType {
    /// Assets and expenses grow with debits (+); everything else grows with
    /// credits (-). Flipping the sign turns a raw ledger sum into the positive
    /// number a non-accountant expects to read on a statement.
    fn sign(self) -> i64 {
        match self {
            AccountType::Asset | AccountType::Expense => 1,
            _ => -1,
        }
    }
}
```

The `balances()` helper (also in `lib.rs`) is the single place every report
— `/reports/balances`, `/reports/income-statement`, `/reports/balance-sheet`,
and the MCP tools that wrap them — pulls its numbers from, and it multiplies
each account's raw ledger sum by `sign()` before anything downstream sees it:

```rust
Balance { name: r.get("name"), kind, cents: raw * kind.sign() }
```

Because every report goes through `balances()`, this is the *only* place the
sign decision is made. If you add a new report, reuse `balances()` and
`lines()` rather than re-deriving totals — see
[Architecture](/openbooks-docs/dev/architecture/#one-set-of-query-functions) for why
that also keeps the HTTP and MCP interfaces from disagreeing.

## No accounting vocabulary in the UI

**The rule:** nobody using the web app, the CLI/TUI, or the desktop client
should ever need to know what a debit or a credit is, or that "double-entry"
is happening at all. They pick an amount, an account, and a category.

**Where it's enforced:** by convention in every client, not by a single
guard in the code. Concretely:

- `openbooks-web`'s README states the rule directly: "Nobody using this
  should have to know what a debit is." Its forms compose the balanced
  two-legged transaction from an amount, an account, and a category; the
  page uses "where money sits" instead of *assets* and "what we hold and
  owe" instead of *balance sheet*.
- `openbooks-cli`'s `legs()` function (`openbooks-cli/src/api.rs`) is the
  same idea in the terminal client: given a `Kind` (`In`, `Out`, `Transfer`),
  an account id, a category id, and an amount, it decides which side is the
  debit and which is the credit, and returns the two `NewEntry` values. The
  human just picked "money in," an account, and a category.
- The desktop client's `views/` follow the same pattern against the same
  API.

Because this rule isn't a single enforced check, it's the one invariant on
this page that a reviewer has to verify by reading each client rather than
pointing at one line. If you add a new client or a new form, keep composing
the two-legged transaction in the client and keep debit/credit language out
of anything the user reads.

## Verifying all of this

`just smoke` (backed by `openbooks-api/smoke.sh`) exercises the ledger and
reports end to end: it asserts real numbers (a specific Q1 total, a balance
sheet where assets equal liabilities plus equity) and confirms that posting
an unbalanced or single-legged transaction is rejected. Run it after touching
anything in this page.
