# Database design status

Reviewed 2026-11-03, **v1.2**. The agreed launch scope is represented in **39 tables**. Q84–Q87 are now explicitly accepted; no numbered product questions remain open. The design has passed disposable PostgreSQL execution, selected integrity/concurrency regressions and synthetic query-plan checks. It is ready for implementation review; it is not an implemented or deployed backend.

Use all three schema inputs together:

1. [DBML](sahsah.dbml): tables, types, ordinary constraints and relationships.
2. [PostgreSQL supplement](postgresql-supplement.sql): 19 partial indexes.
3. [PostgreSQL guards](postgresql-guards.sql): ledger-owned balance projection, financial proof/transition checks and accepted lifecycle/retention boundaries.

The [quality review](design-quality-review.md) explains each improvement and its trade-offs. [ADR 0010](../adr/0010-ledger-projection-and-postgresql-integrity.md) records database ownership of token movements. The [table guide](table-guide.md) still explains every table in simple words.

Prepared 2026-11-04: the [complete implementation prompt and handoff](implementation-prompt.md) carries the application rules, every numbered decision, overrides, table inventory, validation evidence and the next backend schema-implementation task into a new model session.

Subsequent implementation on 2026-11-04 delivered the Drizzle schema, versioned migrations and minimal NestJS database foundation. See [implementation status](implementation-status.md) for current code, the explicitly required gift percentage, validation and remaining application work. The design audit below records the earlier checkpoint.

## Coverage

| Area | Current representation |
| --- | --- |
| Catalog/content | Categories, fixed six-question packs, ten mixed formats, current/retired identities, manual AdminJS authoring, public edits, ready media and archival. |
| Games/progress | Reusable rooms, distinct games, six people including host, two teams, 36 starting snapshots, timers/hints/resolutions, score actions, frozen roster, exposure/completion and host control. |
| Identity/invitations | Egypt profile and Firebase mapping, WhatsApp proofs, authorized phone change, six-digit invitations, readiness, reconnect credentials, removal/unblock and explicit deletion consent. |
| Bank/commerce | Permanent combined bank, sourced append-only ledger, atomic game charge/restoration, website pricing 1–20, gifts, fixed-bundle codes/automatic campaigns, quota holds and deletion forfeiture. |
| Payments | Paymob attempts/transactions/evidence/cases; native personal 1/2/5 SKU mappings and purchases; shared once-only orders/credits, trusted proof families, owner binding and completion after delivery. |
| Staff/public operations | Admin manages operations; Super Admin additionally manages staff. Three staff tables, contact inbox, public pages/branding, feedback and durable leased work. |
| Retention | Twelve-month copied content, compact results/progress/votes afterward, closed post-purge feedback, media-reference checks, one-way PII redaction and campaign-local phone markers until end. |

All original 61 tables are accounted for by the [37-table consolidation](schema-simplification-review.md); two native records were subsequently added. Public CMS, phone changes and automatic campaigns remain included. There is no customer cash-out, source-lot accounting or native gifting scope.

## Executed validation

Pinned `@dbml/cli@10.3.1` under Node 24 exports the model. PostgreSQL 18.6 successfully loads the export and both companion SQL files. Catalog inspection confirms **39 tables, 37 enums, 87 foreign keys, 304 named CHECK constraints and 148 indexes**, including PK/UNIQUE backing structures and 19 partial indexes. Every FK's exact types, arity and PK/UNIQUE target were also checked structurally.

The [validation runner](validation/README.md) passes 68 checks, including six concurrent cases: starts, payment handlers, campaign admission, final room seats, deletion versus checkout, and purge versus media insertion. [Latest results](validation/latest-results.json) contain the full outcomes and raw plans. The synthetic index fixture uses 100,000 jobs, 10,000 terminal games, 50 additional active games and 4,080 additional questions. These measurements do not establish application throughput or Railway room capacity.

Application code, dependencies, lockfiles, provider accounts and deployed databases were unchanged. Earlier v0.9/v1.0/v1.1 checkpoint counts remain historical in the session log; their “no SQL execution” statements describe those checkpoints only.

## Remaining implementation work

Translate this design into versioned backend migrations and restricted runtime-role privileges; implement/verify NestJS game, identity, checkout and admin actions; test Paymob/Apple/Google adapters and sandbox transactions; configure operational TTLs and approved financial/legal retention before their cleanup jobs; run deployed load tests and backup recovery. Exact discount percentages, merchant/store configuration and operational batch/pool sizes are configuration inputs, not additional tables or unresolved feature choices.

DBML alone does not enforce complete six-slot publication, all 36 starting rows, current host authority, pricing winner eligibility, cryptographic proof validation or every score/progress transaction. Those service contracts are documented and must be tested when implemented. The local guards and reference tests provide stronger evidence than a parser-only design, without claiming production sign-off.
