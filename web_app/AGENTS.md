# web_app engineering principles

These rules cover `backend/` and `frontend/`. They record conventions and the reasons behind them that the code does not state. The decisions themselves are in `docs/adr/` (start with 0012, 0015, 0017 and 0018) and the wire contract is in `docs/api/`. Read the ADR behind a pattern before you change it.

## Shape of the code

- **Feature folders.** Backend gameplay lives in `backend/src/gameplay/<feature>/` (catalog, rooms, games, realtime, media, preview, maintenance). Shared mechanisms live in `gameplay/platform/`. Put new behaviour in the feature that owns it, and give a new folder only to a new feature. Keep layers concrete: introduce an interface when there is a second implementation behind it (ADR 0018).
- **One host-action pipeline.** Every host command goes through `games/pipeline.ts`, which handles locking, host checks, receipts, the time and version checks and post-commit hints. Add a handler under `games/commands/`. The pipeline stays the single path.
- **Contracts first.** Request and response shapes come from the Standard Schema contracts in `gameplay/contracts/`, and database types come from Drizzle. Change the contract, regenerate with `pnpm types:contracts`, then the code. The frontend mirrors the wire types in `frontend/src/lib/api/types.ts`.
- **Single source of truth.** Each rule, limit, message and response shape is written once and imported everywhere else. For example: every problem response comes from `sendProblem` (`platform/problem.ts`), the rate policy from `httpRatePolicy` (`platform/http.ts`), the client key from `sourceKey` (`platform/rates.ts`), and the player-facing Arabic text for each problem code from `frontend/src/lib/api/problems.ts`. When you find a second copy, extract it before extending it.

## Every request is defended in depth

Each layer refuses work as early and as cheaply as it can. Every new endpoint and socket event gets every layer:

1. **Edge** (`edgeProtection`): security headers and a per-client token bucket on every route, before body parsing, AdminJS or Nest.
2. **Body limits:** JSON bodies are at most 16 KB on `/api/v1`. WebSocket frames are at most 8 KB, with a per-connection token bucket, a bounded queue and a 5-second authentication deadline.
3. **Subject limits** (`GameplayHttpInterceptor`): a token bucket per verified account or guest, plus fair scheduling between the public and protected lanes.
4. **Admission** (`platform/admission.ts`, ADR 0015): new rooms, joins and game starts are refused when there is sustained load (3 consecutive samples over 85%) or the room capacity is full. Active games are never cut.
5. **Validation:** schemas with whitelisting reject unknown fields. Treat every database value read back as data to validate at the boundary.

A client is identified by `sourceKey(clientAddress(req))`: an IPv4 address or an IPv6 /64, seen through exactly `TRUSTED_PROXY_HOPS` proxies. Set that variable to the platform's real proxy count on every deployment. With 0 behind a proxy, every player shares one bucket. Rate limit buckets, admission and receipts live in process memory, and `claimGameplayProcess` enforces one API process. Scaling out means moving that state to a shared store first.

## Every write is idempotent

Every POST, PUT or PATCH that changes state reads `Idempotency-Key` through `RoomReceipts.operation(req)`, stores a receipt in the same transaction as the effect, and on a retry replays the receipt instead of redoing the work. The frontend creates the key once per user intent (`lib/use-intent-keys.ts`) and saves it before sending, so a retry after a timeout recovers the original outcome. Database writes run inside `database.transaction`, in the lock order the pipeline uses. External HTTP calls (storage, providers) happen outside transactions, and realtime pushes go through the outbox after commit.

## Truthful UI

The player sees a status, warning or error only when it is true for them right now. Drive each message from a real response, a problem `code` or a projection field. Map each code to its own honest Arabic text. When the cause is unknown, say so ("حصلت مشكلة") rather than borrowing a more specific message.

## Observability

- **Logging:** use `log.info|warn|error(scope, fields)` from `platform/logging.ts` (Pino with AsyncLocalStorage context). Request, operation, room, game and account IDs are attached automatically. Fields are the typed, allowlisted `LogFields`. Log codes, counts and durations. Request bodies, credentials, secrets, passcodes, invitation codes, phone numbers and signed URLs stay out of logs (ADR 0018). Log an error once, at the boundary that handles it.
- **Metrics:** `platform.metrics` logs one line per minute with command p95/p99, outbox delay, event-loop p99, memory, refusals, occupancy and admission state. Build dashboards and alerts on that line. Add a new signal to `GameplayMetrics` and `LogFields`.
- **Health:** `/api/health` is liveness. `/api/health/ready` checks the database and caches the result for one second.

## Performance

- Every query filters and sorts on an index, a primary key or a partial index (`src/database/schema/`). A new query shape comes with its index in the same migration. Paginate with keyset cursors (`ORDER BY key, id` with `> (key, id)`), never with `OFFSET`.
- Keep transactions short. Batch reads with `inArray` instead of querying in a loop. Fetch only the columns the response needs.
- Bound every in-memory map, queue and cache with a size cap and an eviction rule, like `GameplayRates`.
- Frontend: use server components by default and client components where interaction needs them. Static assets go through `next/image`. Signed, short-lived question media goes through `MediaImage`, because there is nothing to optimise or cache.

## Done means verified

Run `check`, `build` and `test` in each application you touched, plus `test:database` for schema or query changes, and add a test for every new rule or limit. CI runs the same commands (`.github/workflows/web-app.yml`).
