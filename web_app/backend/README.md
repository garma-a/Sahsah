# Sahsah backend

Independent NestJS 12.3.3 API with Drizzle ORM 0.45.4, Drizzle Kit 0.31.11 and node-postgres 8.23.1. These are the stable releases selected on 2026-11-04. Use Node 24 LTS and pnpm 10.34.3. The application schema targets PostgreSQL 18 and was verified on 18.6.

```sh
pnpm install --frozen-lockfile
cp .env.example .env
pnpm dev
```

The API defaults to http://localhost:3001/api/health. Run `pnpm check`, `pnpm test`, `pnpm test:database` and `pnpm build`; use `pnpm start` after building. This directory can be copied, installed and run without the frontend, prototype or parent repository. Where pnpm is unavailable, use `npx --yes pnpm@10.34.3`.

## Database setup

The 42-table schema is in `src/database/schema/`, grouped by domain with camelCase TypeScript properties and the agreed snake_case database names. All 37 enums, 95 foreign keys, 315 checks and 158 indexes (21 partial) are represented. `drizzle/0000_sahsah_schema.sql` creates the physical schema; `0001_postgresql_integrity.sql` preserves foreign-key deferral and the 28 private PostgreSQL helper functions and 28 triggers. No shop, staff, player, provider or authored content rows are inserted automatically.

Provision a **new local database** using an existing PostgreSQL administrator connection:

```sh
psql --dbname="$LOCAL_POSTGRES_ADMIN_URL" \
  -v database_name=sahsah -v migration_role=sahsah_owner -v runtime_role=sahsah_app \
  -f scripts/database/provision.sql
```

The variables name new resources; existing names fail. Configure passwords with interactive `psql` commands `\password sahsah_owner` and `\password sahsah_app`, or use your platform's certificate/secret management. No password is embedded in the script. Managed PostgreSQL may require its administrator to provision the equivalent dedicated roles/database through the platform.

Use a separate migration-owner credential for explicit schema commands. Keep it out of the API deployment. Set `MIGRATION_DATABASE_URL` securely in the migration environment, and set `DATABASE_RUNTIME_ROLE=sahsah_app`:

```sh
pnpm db:status
pnpm db:migrate
pnpm db:grant-runtime
pnpm db:status
```

Configure the API's `DATABASE_URL` with the **runtime** credential for the same database, then start the API. Reapply `db:grant-runtime` after migrations that add tables or change writable account columns. This command grants the intended domain access, denies direct bank/history changes and private helper execution, and grants read-only migration-history access. It does not create users, set passwords or grant role membership. The runtime role must have no inherited ownership/admin/DDL privileges. Startup verifies this boundary and rejects a migration-owner connection.

For remote connections, use the provider's trusted TLS configuration, such as certificate-verified `sslmode=verify-full` where supported. Credentials and signing/encryption keys belong in secret management; do not put them into schema files or application JSON. Remote/production provisioning and migration targets need explicit authorization; this implementation was exercised only on disposable local databases.

## Connection and health behavior

`DATABASE_POOL_MAX` defaults to 5, bounded at 20. Connect, idle, statement, lock and idle-transaction timeouts are explicit bounded settings in `.env.example`; they are starting configuration, not a capacity guarantee. PostgreSQL sessions use UTC. Present local dates in Africa/Cairo at the client boundary.

An empty `DATABASE_URL` keeps the development/test starter available. Production requires a URL. A supplied malformed URL, unreachable database, incomplete/changed migration history or unsafe runtime role fails initialization; startup applies no DDL. Ship `drizzle/` alongside `dist/` in the deployment artifact so the API can verify its expected history. `/api/health` is process liveness. `/api/health/ready` returns 200 only when the configured migrated database is usable; otherwise it returns 503. Nest shutdown closes the pool.

Inject `DatabaseService` for typed Drizzle queries. Use `database.transaction(async (db) => { ... })` for atomic writes. It uses one checked-out connection, commits before returning, rolls back on statement **or deferred COMMIT** failure, and always releases/discards the connection. It also rejects a callback that swallowed a SQL error and caused PostgreSQL to roll back at COMMIT. Do not hold a transaction across provider/storage HTTP, use `pool.query` for transaction statements, or retry unknown external effects automatically. Deadlock/serialization retries belong to each future operation's durable request identity.

Insert a sourced `token_ledger_entries` movement to change a bank; its INSERT trigger alone projects the balance. Never update the balance separately. The gameplay module implements the full-board, authorization, credential and game lock-order contracts; pricing/provider workflows remain outside gameplay.

PostgreSQL bigint columns map to JavaScript `bigint`; exact `numeric` maps to decimal strings, `bytea` to `Buffer`, and `timestamptz` to strings preserving microseconds. Convert bigint values deliberately to decimal strings at an HTTP/JSON boundary; do not coerce them to imprecise numbers or add a global JSON monkey patch. Schema JSON types provide compile-time structure; services must validate bounded runtime content.

## Migrations and recovery

Use `pnpm db:generate` for future schema changes and `drizzle-kit generate --custom --name=description` for PostgreSQL behavior that Drizzle cannot express. Review and commit SQL, snapshots and the journal together. `pnpm db:check` checks the migration graph. `db:migrate` uses Drizzle's maintained migrator on a dedicated connection with an advisory lock spanning history verification and migration application. All pending domain DDL commits in one transaction. Apply/status compare every applied hash and timestamp to the checked-in history and reject changed, missing, reordered or unknown migrations. Never edit a migration that has been applied to a retained database.

The initial SQL deliberately creates unique indexes **before** foreign keys that reference them; Kit's generated order otherwise fails on the composite references. Review this dependency order for future generated migrations. All 95 foreign keys are `DEFERRABLE INITIALLY IMMEDIATE`, matching the accepted export; the financial/deletion/purge constraint triggers retain their individual deferred semantics. Column-unique constraints use Drizzle's explicit generated `_unique` names instead of the export's automatic `_key` suffix. Composite primary keys preserve PostgreSQL's physical `_pkey` names. This changes naming only.

Partial indexes are modeled in Drizzle so future generation retains them. Private functions, triggers, trusted search paths, revoked helper privileges and FK deferral remain reviewed custom SQL. Use the guarded commands; `drizzle-kit push`/automatic synchronization is not the deployment workflow and must not replace these migrations.

A failed batch rolls back its domain DDL; empty migration bookkeeping may remain. Fix the cause and rerun the unchanged reviewed migration. Applied-checksum failure requires restoring the exact applied file and appending a new migration. For a populated database, use reviewed forward repair and verified backups; this repository supplies no destructive down/reset command. For a disposable local database, stop its private cluster and delete that cluster's temporary directory, as the tests do. Never reset an existing database solely because a URL is present in the environment.

## Optional reference setup

The gift discount has **no default**, as explicitly requested. A shop singleton must supply an approved integer in basis points (0..10000). The 100 EGP base and fixed 1/2/5 selectors have approved defaults. To initialize a new local singleton after obtaining the approved value:

```sh
psql --dbname="$MIGRATION_DATABASE_URL" -v gift_discount_bps="$APPROVED_GIFT_DISCOUNT_BPS" \
  -f scripts/database/configure-shop.sql
```

This explicit command fails for a missing/invalid value or an existing singleton. It activates no promotions. Quantity percentages, real SKU/merchant/project IDs, staff credentials, authored content and operational/legal retention configuration must be supplied separately. No first-staff bootstrap or guessed legal copy is included.

## Validation

```sh
pnpm check
pnpm test
pnpm test:database
pnpm db:check
pnpm build
```

The HTTP tests preserve health, CORS, disabled/misconfigured admin, login, cookies and asset delivery without needing a database. The database suite requires Python 3, `psql` and PostgreSQL 18 binaries, runs as a normal user and creates its own private Unix-socket cluster with TCP disabled. Set `PG_BIN` if the binaries are not in `/usr/lib/postgresql/18/bin`. It never reads a supplied database URL for its target and removes its cluster on exit.

The suite runs 68 backend-owned SQL reference cases against the **actual migrations as the restricted runtime role**, including six independent-connection races. Two mutation-rejection cases now verify permission denial before the underlying guard. Additional Node integration cases verify typed sourced credits, exact numeric/hash/timestamp handling, COMMIT failure and connection release, readiness, role restrictions, repeat/status/checksum behavior, competing migrators and atomic failure recovery. Reference fixtures are adapted from the accepted v1.2 audit and copied here so this application remains independent. Reference functional cases force deferred checks and roll back; the concurrency and Node transaction cases perform real commits.

## Implemented boundary

This increment implements schema, migrations and the NestJS database foundation. Account/game/payment APIs, provider verification, media/retention/outbox workers and staff authentication/session persistence remain later work. The presence of their tables does not implement those features. Production deployment still needs its actual role/TLS/backup configuration and a restore drill; no production database or provider account was used here.

## AdminJS

The dashboard runs in this server at `/admin`, with its implementation in `src/admin/`. To enable it, set `ADMIN_ENABLED=true`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (16+ characters) and `ADMIN_SESSION_SECRET` (32+ characters) in `.env`. Generate the secret with `openssl rand -hex 32`. Restart after changing configuration. Missing credentials prevent startup when admin is enabled.

Authentication uses an HttpOnly, SameSite=Lax session cookie scoped to `/admin`; production cookies require HTTPS. Configure the Express trusted proxy when terminating HTTPS upstream. The starter has no database resources and uses in-memory sessions; add a persistent session store before production admin use.

The staff tables now exist, but AdminJS still uses the starter environment login and memory sessions. Database adapters/resources, staff-backed login, authorization and persistent session serialization remain unimplemented. No separate admin installation or server is needed. Middleware still mounts before Nest's body parser and catch-all handlers.

References: [Drizzle migrations](https://orm.drizzle.team/docs/migrations), [custom SQL migrations](https://orm.drizzle.team/docs/kit-custom-migrations), [node-postgres transactions](https://node-postgres.com/features/transactions), [NestJS databases](https://docs.nestjs.com/techniques/database).

## Gameplay API

The optional gameplay module exposes `/api/v1` REST and `/api/v1/realtime` native WebSocket operations. It defaults to disabled. See [the reviewed contract](../../docs/api/README.md) and [implementation, configuration and load evidence](../../docs/api/implementation-and-operations.md). `0002_gameplay_rooms.sql` and `0003_gameplay_history.sql` add draft selections/receipts, revisions, controller recovery and immutable-history guards. `0004_category_presentation.sql` adds category sections, descriptions and public covers. Reapply runtime grants after migrating.

`pnpm test` includes contract metadata, full-cycle HTTP/WS, all-format media and contention tests against disposable PostgreSQL. For a bounded local smoke measurement run `pnpm build` then `LOAD_ROOMS=10 LOAD_CYCLES=2 node scripts/gameplay-load.mjs`; up to 100 rooms/600 clients are supported by this fixture. This never certifies a Railway deployment. No frontend/prototype/mobile gameplay UI is migrated by this backend change.

### Run the game locally

```sh
docker compose up -d            # PostgreSQL 18 on localhost:5433, with local-only roles
cp .env.example .env            # then set the values below
pnpm db:migrate && pnpm db:grant-runtime
pnpm content:seed               # placeholder categories, packs, questions and media
pnpm dev
```

Local `.env` values: the two database URLs shown in `.env.example`, `GAMEPLAY_ENABLED=true`, `GAMEPLAY_PREVIEW_PASSCODE` (six characters or more), `GAMEPLAY_PREVIEW_SECRET` (`openssl rand -hex 32`) and `GAMEPLAY_LOCAL_MEDIA_DIR=.media`.

**Preview mode** ([ADR 0017](../../docs/adr/0017-passcode-preview-without-login.md)) stands in for login until it exists. `POST /api/v1/preview/sessions` with `{ "passcode", "displayName" }` creates a host account for that browser with 10,000 tokens and returns a 30-day `credential` to send as `Authorization: Bearer …`; sending `{ "credential", "displayName" }` renews it. Preview admission uses API process pressure only and admits 20 open rooms. It is off unless the passcode is set, refuses to start alongside `GAMEPLAY_IDENTITY_JWKS_URL`, and its database must be discarded before real accounts exist.

**Media storage** is chosen by configuration. With `GAMEPLAY_LOCAL_MEDIA_DIR`, files live under `private/` and `public/` in that directory and this API serves them at `/api/dev-media` (private files only through five-minute signed links); production refuses this setting. Otherwise private question media is signed from R2 and category covers are read from `GAMEPLAY_PUBLIC_MEDIA_BASE_URL`. `pnpm content:seed` writes to whichever storage is configured and can be rerun safely; for R2 it needs the write-capable `R2_IMPORT_*` key and `R2_PUBLIC_BUCKET`, which the API deployment never receives.

Behind a platform proxy set `TRUSTED_PROXY_HOPS` (Railway: 1) so rate limits and pending-connection limits apply per player rather than to the proxy.

## How to add a feature or a host action

Gameplay is moving into feature folders under `src/gameplay/`: catalog, rooms (including lifecycle), games, realtime, media, preview and maintenance. Shared platform code owns transactions, receipts, outbox hints, clocks, admission, scheduling, HTTP helpers and logging. Keep each feature's business rules beside its implementation; avoid sibling application imports and generic repositories. [ADR 0018](../../docs/adr/0018-feature-folders-and-action-pipeline.md) records the accepted structure.

For an HTTP operation, use the reviewed Standard Schema request and response objects in `contract.ts`. Use `Contract<"SchemaName">` from `contract.ts` for body/result types and `$inferSelect`/`$inferInsert` for Drizzle rows and writes. Regenerate the checked-in type metadata with `npm run types:contracts` after an approved contract edit; AJV and the existing Standard Schema objects still own runtime validation. Keep the exact authorization, receipt recovery and lock order of the surrounding operations. Business-rule failures use `requireState` with the existing problem code/status; impossible states use `invariant` with a stable diagnostic code and safe context. Check single-row results and state/version/position/score invariants before committing.

Host commands will share one pipeline: lock the game, check host control, recover its receipt, lock the roster accounts, check the host account, take fresh database time, expire idle games, check status/version, run the handler, then save the receipt and hint. Add handlers to the typed command registry as that extraction lands. Keep pure scoring/turn/position rules separate from database work. Starting a game follows named validation, selection, snapshot, media and receipt steps in the same transaction. Never move network effects under write locks.

Log through the scoped logging helper: include a module/function scope and enrich the current context with known operation, room, game and account IDs. Request bodies, authorization/guest/control/preview credentials, signed URLs, invitation codes and phone numbers must never be logged, including through error messages or SQL parameters. Each HTTP request has one UUID: a caller's `X-Request-Id` when it is a UUID, otherwise a new one. It appears in every log line, in the `X-Request-Id` response header and as the problem body's `requestId`, so a tester's error report leads straight to the logs. Sockets and maintenance passes have their own IDs. Problems are logged once where they leave the API (HTTP filter or socket revoke): 4xx and 503 as `warn`, other 5xx as `error` with a safe summary (error name, database code and constraint) and stack frames. `LOG_LEVEL` defaults to debug locally and info in production; tests force silent.

Run `npm run check` and `npm test` after each commit and `npm run test:database` before handing over a branch. Existing tests change only when imports move; add tests for new pure rules/helpers. These suites own disposable PostgreSQL clusters and must never target the seeded local Docker database.
