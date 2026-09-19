<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project rules

## Weigh the cost of running the database

Motor Hub runs on a hosted SQLite database (Turso) on a free tier, and the
whole point of the app is that a record survives for years. Storage, row reads
and row writes are therefore a design constraint, not an afterthought.

When proposing or reviewing a change, state its database cost as part of the
reasoning, alongside correctness and clarity:

- **Reads per page.** How many queries does a page fire, and does that number
  grow with the size of the fleet or the length of a vehicle's history? A query
  inside a loop over parts is the usual way this goes wrong.
- **Rows scanned.** Does the query use an index, or does it scan a table that
  grows forever? `part`, `service_record` and `usage_reading` only ever grow —
  nothing is deleted when a part is replaced.
- **Rows written.** Prefer one statement that writes many rows over many
  statements that write one. Avoid writing rows the user did not ask for.
- **Storage.** Attachments dominate; database rows are small. Do not store
  derived values that a query can compute unless the query is measurably
  expensive.

Say the cost out loud in the design, even when it is negligible: "this adds one
indexed query per vehicle page" is a complete answer. Prefer the cheaper of two
otherwise equal designs, and when the more expensive one is right, say why it
earns the cost.
