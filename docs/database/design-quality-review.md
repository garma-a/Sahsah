# Design quality review: v1.2

Reviewed 2026-11-03. The user authorized technical improvements and accepted Q84–Q87. The design retains **39 tables**, all agreed launch features and the two simple staff roles. The [DBML](sahsah.dbml), [partial indexes](postgresql-supplement.sql) and [transition guards](postgresql-guards.sql) form one design artifact. No application code or production database was changed.

## Changes and reasons

| Change | Reason and short example |
| --- | --- |
| Ledger-owned balance projection | Appending `+5` updates the bank automatically in that transaction. A payment retry cannot independently add another five to the balance. No full-history SUM on each write. |
| Smaller channel-specific checks | Website/native payment shapes are readable named conditions instead of two large intertwined expressions. Required values cannot bypass checks through NULL. |
| Frozen checkout digest and intent | Reusing an order request key with a different quantity/recipient/price is rejected; the original canonical digest survives PII redaction. |
| Typed payment observations | A Google RTDN points to a receipt; only a processed Google API PURCHASED observation can fund the order. Apple uses verified transaction JWS. |
| Verified settlement and delivery together | Correct Paymob amount/currency/integration or valid native product/units, accepted source and a bound account's one ledger credit commit together. Native completion follows delivery. |
| Stable financial history | Accepted funding never moves to another payment/account; later refund/revocation evidence does not erase the original credit or make the bank negative. Verification projections cannot rewind. |
| Explicit unpaid closure | An inquiry with `confirms_closed_unpaid=false` cannot close an attempt or justify releasing its promotion hold. |
| Q84 room removal | A removed known account stays blocked until host unblock; its old credential remains revoked. New membership is required. Removal is lobby-only; six seats include host. |
| Q85 retained feedback | Purge keeps the original vote but closes further votes/edits. Due-date checks and media-pin guards prevent recreating the old content archive. |
| Q86 deletion funding checkpoint | Block new orders/bindings, settle or explicitly review known pending funding, then confirm the exact bank. A new receipt or credit invalidates that confirmation and requires a fresh review. Forfeiture cannot commit alone. |
| Q87 free campaign allowance | Count buyer account OR campaign-local phone fingerprint, once per usage. Recreating an account on the same phone cannot restart that campaign's free allowance. Remove the fingerprint after campaign end. |
| One-way PII redaction | OTP/phone-change/gift payloads may clear without breaking referenced proof IDs. Erased fields cannot be restored through an ordinary update. |
| Sparse operational indexes | Keep pending jobs, running leases, active/due games and live phone/history lookup entries out of full-history indexes where appropriate. |
| Remove redundant/incorrect indexes | Drop two settlement-source UNIQUE constraints already implied by complete source FKs, and the extra current-question index served by current-slot uniqueness. Remove global inquiry/native facts uniqueness: a later PURCHASED → REVOKED → PURCHASED observation can repeat facts legitimately. Transport delivery identities and one order credit still deduplicate effects. |

The original 150 planned indexes become **148**, including primary/unique backing indexes and **19 partial indexes**. Necessary composite FK backing keys remain. This small net reduction is not the main benefit: most maintenance indexes now omit inactive history.

## Executed evidence

The reproducible [validation runner](validation/validate_design.py) exports with `@dbml/cli@10.3.1`, starts a fresh private Unix-socket PostgreSQL 18 cluster, loads all three schema inputs, runs positive/rejection cases and competing SQL transactions, and stops the cluster. [Latest results](validation/latest-results.json) retain counts, outcomes and `EXPLAIN (ANALYZE, BUFFERS)` plans. No supplied production connection is accepted by the runner.

The current suite passes **68 checks**, including six cases using concurrent PostgreSQL connections. The pre-audit v1.1 snapshot actually accepted two invalid cases: a mapped native notification funding a pending purchase, and an inquiry without affirmative unpaid confirmation closing checkout. [Recorded reproductions](validation/before-audit-reproductions.json) identify the snapshot hash and outcomes; the v1.2 regression suite rejects both.

The index fixture has 100,000 jobs (20 pending, 20 running), 10,000 terminal games, 50 additional active games, 50 terminal games awaiting purge and 4,080 additional catalog questions. Minimal history rows support access-path measurement; this does not simulate complete historical gameplay or media delivery.

| Index | Full comparison | Current sparse index |
| --- | ---: | ---: |
| Pending jobs | 4,980,736 bytes | 16,384 bytes |
| Running job leases | 4,997,120 bytes | 16,384 bytes |
| Active-game expiry | 516,096 bytes | 16,384 bytes |
| Game content awaiting purge | 425,984 bytes | 16,384 bytes |

The planner used the expected sparse pending/lease/purge paths. At 50 due active games it preferred the existing active-room uniqueness index and a small sort over the separate deadline index; the raw plan records that choice. The six-current-question query uses current-slot uniqueness without the removed full index. These measurements establish footprints and access paths, not a general latency improvement or Railway room capacity.

## Implementation contract

1. Load exported DBML, supplement and guards in that order. Turn this reviewed design into an explicit versioned backend migration; these files have not migrated the starter API.
2. Append a sourced ledger entry and let its trigger project the bank. Treat balance/ledger/settlement/proof resources as read-only in generic AdminJS CRUD; expose validated operational actions to Admin and Super Admin.
3. Use short transactions and a consistent order: game/lobby root where needed, then affected account rows in sorted ID order, commerce order/attempt/source rows, and the selected promotion before allowance counting. Provider I/O happens outside locks. Ordinary game commands never acquire a room lock after a game lock. Retry deadlock/serialization failures using the same durable request key.
4. Ingest and verify provider evidence outside the mutation transaction; reload/lock the account/order/source and recheck that newer observations have not superseded it before fulfillment. Never treat a browser redirect, local timeout, RTDN alone, or raw supplied receipt as verified money.
5. Deferred guards read final transaction rows. Before returning success, commit; an intermediate statement completing is not acceptance. Bound settlement plus delivery and forfeiture plus completed deletion must be atomic.
6. Use a non-owner runtime database role with no DDL/trigger-disable permission, no helper EXECUTE and no generic bank writes. Helpers have a fixed trusted search path and revoked PUBLIC privileges; migration ownership must remain separate. Trigger-depth checks prevent accidental direct writes; they are not a security boundary against a database owner.
7. Keep exact literal partial-index predicates in worker queries (`state='pending'`, `status='active'`, etc.). Bind cutoffs/IDs. Do not assume a generic status parameter permits the same plan. Revisit index selectivity as real history grows.

PostgreSQL's [partial-index documentation](https://www.postgresql.org/docs/18/indexes-partial.html), [row locks](https://www.postgresql.org/docs/18/explicit-locking.html), [deferred constraint triggers](https://www.postgresql.org/docs/18/sql-createtrigger.html) and [security-definer functions](https://www.postgresql.org/docs/18/sql-createfunction.html) inform these choices. `FOR NO KEY UPDATE` is sufficient for financial state locks without unnecessarily conflicting with ordinary FK key-share locks; it does not excuse inconsistent application lock order.

## Scope of this result

The design covers the agreed features and has executed local SQL validation. NestJS gameplay/identity/provider services, AdminJS resources, cryptographic adapters, store/merchant configuration, sandbox transactions, production-role migrations, deployment load tests and backup recovery still require implementation. Operational TTLs and approved financial/legal retention durations are configuration/policy inputs before enabling those cleanup jobs; none were invented here. This review adds no Redis service, read replica, partitioning, permission framework, customer cash-out or native gifting.
