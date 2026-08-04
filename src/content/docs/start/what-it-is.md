---
title: What OpenBooks is
description: Bookkeeping for a family or a club, what it does for the person keeping the books, and what it deliberately hides from them.
sidebar:
  order: 1
---

OpenBooks keeps the books for a family or a small club. You record what came in and what went
out, and it prints the statements you need for the monthly, quarterly, or annual meeting.

That is the whole job. If you are the treasurer of a scout troop, a parent association, a
supper club, or a household, this is the shape of the problem it was built for: a bank
account, a cash box, a handful of categories, a few dozen transactions a year, and someone at
a meeting who wants to know whether the numbers add up.

## What you actually do with it

Four things, and they are all the same shape.

- **Money came in.** Dues, a donation, the takings from a fundraiser. You pick the amount, the
  date, where it landed, and what it was for.
- **Money went out.** Rent for the hall, insurance, refreshments. Same four choices.
- **Money moved.** Cash from the tin into the bank account. Nothing was earned or spent.
- **Print the statement.** Pick a period and read what happened: what came in, what went out,
  and what you are holding.

There is nothing else to learn. See [recording money](/openbooks-docs/use/recording-money/) for
the mechanics, and [statements](/openbooks-docs/use/statements/) for the reports.

## What it hides from you

Underneath, OpenBooks keeps a real double-entry ledger — the same method an accountant would
use, where every transaction touches two accounts and the two sides have to agree.

You will never see that. The interface has no debits, no credits, no journal, and no trial
balance. You choose an amount, an account, and a category, and the app composes the
two-legged transaction for you. This is deliberate, and it is the one rule the project holds
above all others: no accounting vocabulary in the interface.

What you get for it is a guarantee. A transaction is only allowed to exist if its two sides
cancel out, and that rule is enforced by the database itself rather than by the app, so no
software bug can quietly write books that do not balance. If you want to know how that works
without becoming an accountant,
[double-entry bookkeeping](/openbooks-docs/use/double-entry/) explains it from the beginning.

## Four ways to use it

The same books, four front ends. Nobody needs to use more than one.

| | |
|---|---|
| **Web app** | Runs in a browser. The main way in for most people. |
| **Desktop app** | A native window. Keeps a local copy so it still shows you the books when the server is unreachable, going read-only until it can reach it again. |
| **Terminal** | A full-screen text interface, plus a scriptable mode for anyone who wants to pipe figures into something else. |
| **Agent tools** | An MCP server, so an AI assistant can read the books and post to them through the same code the other clients use. |

## What it is not

A proof of concept for a family or a club, not a product, and worth being plain about:

- **It is not multi-tenant.** One installation holds one set of books.
- **There is no permission system.** Anyone who can sign in can do anything anyone else can —
  record, edit, delete, and read every report. For one household or one club treasury that is
  the intended design; if you need a treasurer who can post and members who can only read,
  this is not that.
- **It is not accounting software for a business.** No invoicing, no payroll, no tax, no
  reconciliation against a bank feed, no multi-currency. Every amount is in one currency and
  stored as a whole number of cents.
- **Someone has to run it.** There is no hosted version. See
  [install](/openbooks-docs/server/install/) for what standing it up involves.

## Where to go next

- Want to try it on your own machine? [Quickstart](/openbooks-docs/start/quickstart/).
- Keeping the books for a club? Start with
  [recording money](/openbooks-docs/use/recording-money/).
- Standing it up for other people to use? [Install](/openbooks-docs/server/install/).
- Want to know how it is built? [Architecture](/openbooks-docs/dev/architecture/).
