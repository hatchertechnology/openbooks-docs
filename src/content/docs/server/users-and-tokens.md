---
title: Users and tokens
description: Creating users, minting bearer tokens, and why there's no RBAC.
sidebar:
  order: 4
---

Every route except `GET /health` requires authentication. There is no signup
form and no admin UI for it — users are managed entirely from the command
line, through verbs on the API binary itself (`openbooks-api/src/admin.rs`),
wrapped by `just` recipes that supply `DATABASE_URL` for you.

## Creating a user

```sh
just user-add you@example.com
```

This runs `openbooks-api user add <email>` against the database. It prints a
generated password once:

```
created you@example.com
password: <generated>

Write this down — it is not stored and cannot be shown again.
```

Only the password's hash is stored, so there's no way to recover or display
it again later — losing it means resetting it, not looking it up.

Pass `--password -` to supply your own password on stdin instead of getting a
generated one, which is how `openbooks-api/seed.sh` creates its demo user
without printing a password to a log:

```sh
echo 'a password at least 12 characters' | just user-add you@example.com --password -
```

(`just user-add` passes its arguments straight through, so `--password -`
reaches the binary.)

## Listing users

```sh
just users
```

Prints email, WebAuthn passkey count, and when they were last seen:

```
email                            passkeys  last seen
demo@example.com                        0  2026-08-01T12:03:44+00:00
```

Passkey count is always `0` today — the `webauthn_credentials` table exists
(`openbooks-api/migrations/0004_auth.sql`) but nothing populates it yet, so
password is the only way in.

## Resetting a password

`openbooks-api user passwd <email>` (not currently wrapped by a `just`
recipe) resets a password the same way `user add` sets one — generated unless
you pass `--password -`. It also ends every session and revokes every bearer
token belonging to that user, because a password reset is what you reach for
on a suspected compromise, and it has to cut off access already in flight, not
just future logins.

## Removing a user

`openbooks-api user rm <email>` deletes the user row. Every session, token,
and WebAuthn credential belonging to them cascades away with it
(`on delete cascade` in `openbooks-api/migrations/0004_auth.sql`).

## Minting a bearer token

```sh
just mint-token you@example.com
```

Prints a single token, alone, on stdout — meant to be captured:

```sh
export OPENBOOKS_TOKEN=$(just mint-token you@example.com)
```

This is how every client except the web app authenticates: `openbooks-cli`
and `openbooks-desktop` both read `OPENBOOKS_TOKEN` from the environment
(see [Configuration](/openbooks-docs/server/configuration/)), since neither
has a login flow yet. The token is minted directly against the database —
`openbooks-api mint-token <email>` writes a row to `oauth_tokens` rather than
calling any HTTP endpoint — and is valid for 365 days, prefixed `ob_` so a
leaked one is recognizable in a log or a paste
(`openbooks-api/src/auth/token.rs`). Only its SHA-256 digest is stored; the
raw value is shown once, the same as a generated password.

## Session cookie vs. bearer token

Two credential types exist, carried differently:

| Credential | Who uses it | Carried as |
|---|---|---|
| Session cookie | the web app | `ob_session` cookie, set by `POST /auth/login` |
| Bearer token | every other client — `openbooks-cli`, `openbooks-desktop`, `/mcp`, scripts | `Authorization: Bearer <token>` header |

Both resolve to the same `CurrentUser` on the server side, and both are
accepted on every ledger route (`openbooks-api/src/auth/mod.rs`,
`require_user`). The one asymmetry: `POST /auth/password` — changing your own
password while signed in — refuses a bearer token and requires a session,
because a bearer token is a long-lived machine credential with no second
factor behind it, and letting one change a password would turn a leaked token
into permanent account takeover.

## The 401 challenge

A missing or invalid credential gets a `401` with a `WWW-Authenticate`
header:

```
WWW-Authenticate: Bearer resource_metadata="http://localhost:38081/.well-known/oauth-protected-resource"
```

That metadata endpoint doesn't exist yet — the header is there so an MCP
client can eventually discover where to authenticate without being manually
configured. For now, every client just gets `OPENBOOKS_TOKEN` out of band,
from `just mint-token`.

See [Authentication](/openbooks-docs/dev/auth/) for the full protocol —
password backoff, session expiry, and what a future phase adds.

## There is no RBAC

Any authenticated user — session or token — can read and write the entire
ledger. There's no role, no permission, no per-user scoping of any kind. The
`Credential` enum in `openbooks-api/src/auth/mod.rs` exists only to tell a
session apart from a token for the one password-change exception above, not
to model who's allowed to do what. This is deliberate: OpenBooks is built for
a family or a small club, where everyone with a login is trusted with the
whole ledger, and the cost of a role system would buy nothing anyone using it
actually needs.
