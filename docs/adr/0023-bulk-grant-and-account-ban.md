---
status: accepted
---

# Bulk grants run in chunks under one audit event; bans live in their own table

A **bulk grant** writes one `token_bulk_grant` audit event (reason, quantity and account count in its details) and one `bulk_grants` row, then credits accounts in short transactions of at most `ADMIN_BULK_GRANT_CHUNK_SIZE` accounts. Each chunk advances a durable cursor on the grant row (accounts are visited in id order), so a retried or resumed request carries on where it stopped. Each credit has the idempotency key `bulk:<grant>:<account>`, so a repeated chunk cannot credit twice. A single transaction over every account was rejected: it would hold locks on the whole player base and could outlive the sleeping admin service's request.

Two database rules changed. A staff credit used to be unique per audit event, which allowed one credit per audit event; it is now unique per (audit event, account), so one event can cover many accounts. The ledger source guard also accepts `token_bulk_grant` events (target kind `bulk_grant`) for credits, still requiring an active staff account and a reason. Only active, unbanned accounts are credited; the chunk locks each account and re-checks that, so a ban or deletion request that lands mid-run is respected.

An **account ban** is a row in `account_bans` (reason, who, when, and the lift with its own reason and audit event), at most one active per account. The gameplay API refuses an account with an active ban at authentication, unless the account is in a running game, and again when it creates a room, joins one or starts a game (`ACCOUNT_BANNED`, 403). Those later checks run under the account row lock that the staff ban also takes, so a ban and an admission cannot interleave. A running game is never touched. Guests are not accounts and are unaffected. The mobile app needs its own message for the new code.
