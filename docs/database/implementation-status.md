# Database implementation status

Implemented 2026-11-04 from the v1.2 handoff. The user explicitly selected database schema/migrations plus the minimal NestJS foundation, stable Drizzle ORM 0.45.4 / Kit 0.31.11, latest stable NestJS 12.3.3, and an explicitly supplied gift percentage with no inherited 10% default.

The backend now owns all 39 domain tables, 37 enums, 87 foreign keys, 304 CHECK constraints, 148 index structures including 19 partial indexes, and the original 28 private functions/28 triggers. Source inputs remain preserved as the audited design checkpoint; the application removes the unapproved `shop_settings.gift_discount_bps` default as the accepted implementation change. Column-unique names use Drizzle's `_unique` suffix; foreign-key names/semantics and physical composite `_pkey` names are preserved. The initial migration orders referenced unique indexes before foreign keys.

See [the backend setup and recovery guide](../../web_app/backend/README.md), [typed schema](../../web_app/backend/src/database/schema/index.ts), [initial migration](../../web_app/backend/drizzle/0000_sahsah_schema.sql), [PostgreSQL integrity migration](../../web_app/backend/drizzle/0001_postgresql_integrity.sql) and [ADR 0011](../adr/0011-drizzle-postgresql-foundation.md).

The minimal runtime layer provides bounded pooling/timeouts, typed queries, commit-safe transactions, Nest lifecycle cleanup, migration-history gating and separate readiness. Explicit migration/status commands use Drizzle, checksum verification and an exclusive advisory lock. Provisioning/grant commands keep migration ownership separate from runtime access; tests prove the runtime cannot change banks directly, mutate ledger history, alter/disable triggers, truncate domain tables, assume ownership or execute private helpers.

Executed on Node 24.22.0, pnpm 10.34.3 and PostgreSQL 18.6:

- Backend `check`, `test`, `test:database`, `db:check` and build passed. HTTP coverage retains AdminJS authentication/assets and verifies unavailable database readiness. The database suite has 13 Node test outcomes, including a subtest running all 68 SQL integrity cases as the restricted runtime role against the actual migrated schema.
- The backend frozen install passed; rerunning `db:generate` reported no schema changes. Explicit shop setup rejected missing/out-of-range values and duplicate initialization; a synthetic zero-percent value was exercised only in a disposable database.
- All six independent-connection reference races passed against that application schema: last-token starts, duplicate payment handlers, final promotion slot, final room seat, deletion versus checkout and purge versus new media pin.
- Node cases exercise real Drizzle sourced grants/precision, statement and deferred COMMIT rollback/release with a one-connection pool, runtime-role rejection, reachable/unreachable/unmigrated readiness, repeated migrations, changed-history rejection, concurrent migrators and rollback/retry of failed DDL.
- The original design runner separately passed all 68 checks; its report was written to `/tmp/sahsah-drizzle-reference-results.json`, leaving the checked-in historical report unchanged.
- A separate live catalog comparison matched all 501 columns, 127 enum labels, 741 constraints (including PostgreSQL 18 NOT NULL entries), 148 indexes, 28 function definitions and 28 triggers to the exported reference. It normalized automatic unique-constraint names and the explicitly removed gift default. The local provisioning script and actual migrate/grant/status CLI were also exercised.
- Frontend `check`/`build` passed. No frontend, prototype, deployment or Flutter source was changed.

AdminJS **still uses its scaffold environment login and in-memory sessions**. The new staff tables are schema only. Player identity, publication/gameplay, price calculation, Paymob/Apple/Google adapters, staff resources, media/outbox/retention workers and actual client workflows remain unimplemented. No provider calls, production migration, deployment, load certification or backup restore drill was performed. No shop rows, staff identities, real SKUs, promotions or authored questions were seeded.

The next increment can implement the selected domain service against this tested foundation without reopening the 94 settled product questions. Deployment credentials/targets, approved discounts, real provider/product IDs, authored/public content and operational/legal retention settings still require their actual configuration.
