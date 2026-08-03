---
title: MCP server
description: The Model Context Protocol server mounted on openbooks-api, its tool list, and how it stays in sync with the HTTP handlers.
sidebar:
  order: 5
---

`openbooks-api` mounts an MCP (Model Context Protocol) server on the same
axum app as the HTTP routes, so an AI assistant can read the books and record
transactions the same way the web UI does. It's implemented in
`openbooks-api/src/mcp.rs`.

## Why it's hand-rolled

The module doc comment explains the choice directly:

> Hand-rolled rather than pulled from an SDK: MCP is JSON-RPC 2.0, and the
> three methods a tools-only server needs are short enough that a dependency
> would be more surface than the protocol.

There's no MCP SDK dependency in `openbooks-api/Cargo.toml`. `src/mcp.rs`
implements just enough JSON-RPC 2.0 to serve `initialize`, `ping`,
`tools/list`, and `tools/call`.

## Connecting

The endpoint is `POST /mcp` on the same host and port as the rest of the API
(`http://localhost:38081/mcp` by default). It's request/response only — there's
no server-initiated stream, so `GET /mcp` returns `405 Method Not Allowed`
(handler `mcp::no_stream`, wired as `.get(mcp::no_stream)` in
`openbooks-api/src/main.rs`).

The repo's `.mcp.json` already points a client at this URL. You can also talk
to it directly:

```sh
curl -s localhost:38081/mcp -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | jq -r '.result.tools[].name'
```

Notifications (a JSON-RPC request with no `id`) get an empty `202 Accepted`
back rather than a JSON-RPC result — the handler checks for `id` before
dispatching.

### Protocol version and errors

`initialize` echoes back whatever `protocolVersion` the client sent, or
defaults to `2025-06-18` if the client didn't send one. This server declares
only `"tools": {}` in its capabilities — no resources, no prompts.

JSON-RPC errors are still transport-level successes: the HTTP status is
always `200`, and the error travels inside the JSON-RPC envelope as
`{"error": {"code": ..., "message": ...}}`. Ledger rejections (an unbalanced
transaction, an unknown account) map to `-32602` (invalid params); anything
else maps to `-32603` (internal error). This mapping happens in `mcp.rs`'s
`From<crate::AppError> for RpcError`, based on whether the underlying HTTP
status would have been `400`.

## Tools

`tools/list` returns six tools, defined in the `tools()` function in
`openbooks-api/src/mcp.rs`:

| Tool | Params | Required | Notes |
|---|---|---|---|
| `list_accounts` | none | — | list every account and its kind |
| `account_balances` | `from`, `to` (date strings) | none | balance per account over an optional window |
| `income_statement` | `from`, `to` | both | rejects if `to` is before `from` |
| `balance_sheet` | `as_of` | yes | snapshot as of one date |
| `list_transactions` | `from`, `to` | none | transactions with entries, newest first |
| `record_transaction` | `occurred_on`, `description`, `entries[]` | all | each entry is `{account_id, amount_cents}`; entries must sum to zero |

Date parameters are strings like `2026-03-31`; `mcp.rs`'s `date_arg` and
`required_date` helpers parse them and return JSON-RPC `-32602` on a bad
format (`"{key} must be a date like 2026-03-31, got '{s}'"`).

`record_transaction`'s tool description spells out the sign convention for a
calling model:

> Entries are signed cents — debit positive, credit negative — and must sum
> to zero. Spending $45 from checking on food is +4500 against Food and
> -4500 against Checking Account. Money received is positive against the
> asset account and negative against the income account.

### Calling a tool

```sh
curl -s localhost:38081/mcp -H 'content-type: application/json' -d '{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "record_transaction",
    "arguments": {
      "occurred_on": "2026-03-05",
      "description": "Meeting pizza",
      "entries": [
        { "account_id": 7, "amount_cents": 4500 },
        { "account_id": 1, "amount_cents": -4500 }
      ]
    }
  }
}'
```

A tool result comes back as both `content` (a single text block containing
pretty-printed JSON, since that's what a model reads best) and
`structuredContent` (the same data as real JSON):

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "content": [{ "type": "text", "text": "{\n  \"recorded\": true,\n  \"id\": 42\n}" }],
    "structuredContent": { "recorded": true, "id": 42 }
  }
}
```

## Tools delegate to the HTTP handlers' own functions

Every tool in `mcp.rs` calls the same `*_data` function the matching HTTP
handler calls in `main.rs` — `accounts_data`, `account_balances_data`,
`income_statement_data`, `balance_sheet_data`, `transactions_data`, and
`create_transaction_data`. None of the query or validation logic is
reimplemented in `mcp.rs`.

That's a deliberate invariant for this codebase, not an implementation
detail: add or change a report and `mcp.rs` follows for free, and the two
interfaces can't drift apart or disagree about the ledger. `smoke.sh` asserts
the HTTP and MCP paths return identical numbers for the same query.

`record_transaction` goes through `create_transaction_data`, so it gets the
same validation as `POST /transactions` — an unbalanced or single-legged
transaction comes back as JSON-RPC `-32602` rather than being written to the
database.

:::note
If you're extending the API, this is the rule to follow: implement query or
report logic once in a `*_data` function used by the HTTP handler, and have
the MCP tool call that same function. Don't write a second, parallel query in
`mcp.rs`.
:::
