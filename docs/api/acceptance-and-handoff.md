# Gameplay acceptance and implementation handoff

Design baseline 2026-11-06. The nineteen product decisions are accepted; the complete package still needs the user's final shared-understanding confirmation. These are required implementation checks, not results already obtained. No new runtime code, dependencies, migration, provider configuration, load test, remote PR or merge has been created in planning.

## Deliverables and scope

Implement [OpenAPI](openapi.json), [gameplay behavior](gameplay-contract.md), [realtime](realtime-protocol.md), [schema/transactions](schema-and-transactions.md) and [capacity admission](admission-control.md) as one coherent backend feature set. Preserve the prototype, its lockfile/assets/behavior/deployment, existing AdminJS integration and all independent application boundaries. Do not migrate gameplay UI into the frontend, build/install Flutter or add excluded auth/payment/public-page/staff workflows without a separate request.

The gameplay module consumes a verified principal, existing bank and published ready content. Production must reject unverified callers; test composition may inject fixtures directly. This phase does not implement login/OTP/checkout. Do not claim a public end-to-end release is usable until the required upstream identity/configuration and real content are wired and verified.

Start implementation on a **new implementation branch** and open a **new PR** for review. The planning branch is `docs/gameplay-api-design`. Follow [AGENTS.md](../../AGENTS.md), use Node 24 LTS/pnpm 10.34.3 from each application directory, and merge only after the user's approval.

## Implementation order

1. Add the focused reviewed migration/typed schema/grants: root/member revisions, room controller/source metadata, selections/receipts, one-open-room invariant, lobby deadline support, feedback version and frozen-history guards. Exercise against restricted runtime and retain the foundation's existing guarantees.
2. Add strict request/response schemas, native Nest Standard Schema validation/serialization, Problem Details, existing-principal adapters, canonical digest/proof utilities and bounded transaction/admission scheduling. Generate OpenAPI from implementation and compare its behavior with the reviewed artifact.
3. Implement recoverable room/create/join/setup/Ready/invitation/control and source-based lost-response paths. Verify independent invitation, lobby and game deadlines before paid Start.
4. Implement catalog/group-freshness reads, atomic Start, every question-format projection/transition, scoring/progress, final results and host question feedback. Use the existing ledger boundary; no payment-provider calls.
5. Add direct R2 access/renewal and native WS projection fanout, one-stream handover, heartbeat/backpressure/auth expiry, transient host playback visuals and snapshot recovery.
6. Add expiry/room-checkpoint/outbox/retention work with leases, bounded queues/cache, resource-pressure sampling and admission. Verify crash/retry/restart behavior before staging load tests.
7. Run required checks and load evidence, document remaining deployment prerequisites, and create the reviewable PR. The PR must describe what works and what remains unmeasured/configuration-dependent.

## Required deployment inputs

Declare and validate configuration when implementation is enabled; no credentials are requested or provisioned during planning. Required inputs are the injected verified-principal integration, existing restricted database URL, canonical HTTPS join base URL/browser origins, private R2 account/bucket/read-signing credentials, and the measured capacity profile with effective API/database limits and timestamped pressure sources. Keep secrets in deployment secret storage. R2 uses its S3 endpoint/region `auto`; clients receive short-lived GET URLs rather than signing credentials. Missing gameplay prerequisites must fail closed, never enable arbitrary account-ID headers or public private-media URLs.

Use the agreed initial timeout/rate/cache/URL settings as validated configuration defaults and record any staging changes. Confirm the join URL targets the new web/mobile-compatible flow rather than the prototype's four-digit simulation. Preserve AdminJS parser/session boundaries. Verify the single-process drain/restart admission assumption before deployment; real Railway limits and metric delay remain measurement inputs.

## Required invariant and concurrency scenarios

| ID | Scenario | Required outcome |
| --- | --- | --- |
| R01 | Same room Create retried after response loss, closure and a later room creation | Recover original source/outcome; no second room, no stale control reinstall. |
| R02 | Concurrent different creates by one host | Exactly one open room, deterministic actionable conflict for the other. |
| R03 | Anonymous Join response lost; code rotates/expires/reuses elsewhere | Locate by saved operation/proof first; recover original membership, never join new code owner. |
| R04 | Two joins claim the last guest place | Host+five total limit holds; one succeeds; rejection has no partial membership/credential. |
| R05 | Ready true/false race and delayed request/retry | Member revision and Ready epoch prevent old intent overwriting newer state; duplicate returns its original receipt. Other members can Ready concurrently. |
| R06 | Pack/category/roster/team changes after Ready; cosmetic/presence changes | Semantic change invalidates everyone once; cosmetic/presence does not. Repeat consent remains bound to actual content/roster and not to unrelated Ready revisions. |
| R07 | Start races Ready, team change, Join, removal and explicit Leave | One frozen confirmed roster; no unready silently excluded; rejected Start creates no game/debit. |
| R08 | Two starts spend last token or one account appears in two starts | One accepted claim/debit; rejected attempt leaves no partial board. Lost response recovers exact original game. |
| R09 | Publishing/archive/replacement races Start | Validate one complete current source snapshot and exact pins, or reject/reconfirm without debit. |
| R10 | Old controller command/WS/telemetry races takeover and final resolution | Serialize/fence; one current live controller, immutable terminal controller/history, no stale audio access. |
| R11 | Open races End/expiry; COMMIT/deferred failure occurs | Sticky first-open boundary decides restoration once; no exposed content/success before commit. Complete rollback/release on failure. |
| R12 | Resolve repeated by same/different operation UUID; zero award versus nobody | One resolution/effect; correct distinction; all-six completion once and resolution 36 terminal atomically. |
| R13 | Manual target boundary/no-op plus later legal awards | Inputs 0/1,000,000 accepted, out-of-range rejected; later awards may exceed 1,000,000; unchanged target has no version/activity effect. |
| R14 | Leave races opening/completion and new account claim | Room→game lock order; eligible exposure/progress lies wholly before or after departure; release only the matching claim. |
| R15 | Delayed game expiry/room checkpoint arrives after replay | Effective timestamps preserved; no extended lobby window, stale closure, claim deletion or repeated restoration. |
| R16 | Deadline exactly reached while request waits for lock; clock/DST differences | Fresh post-lock database time; 24 elapsed hours; no revival from reconnect/read/late command. |
| R17 | Each of ten formats before/after reveal, all hint/memory phases | Only permitted prompt/media/answer fields. No future prompts, hidden stages/originals, color swatch or early memory detail leak. |
| R18 | Viewer manually requests audio/source asset; URL renewal after control/phase/closure | Deny new unauthorized issuance; old issued URLs retain only accepted bounded lifetime; no raw key/URL proxy. |
| R19 | Reveal followed by timer reset/resume; memory before first hide | Reject illegal transition; no running timer after reveal, no memory answering period before first hide. |
| R20 | Host media failure and host/viewer disconnect | Retry/Pause only by host; authoritative clock continues on disconnect; no automatic replacement/debit/reset. |
| R21 | Old stream close callback follows authorized replacement | New epoch mapping/presence remains intact; one current stream; account-only host tab cannot displace controller. |
| R22 | Unauthenticated/malformed/oversized/expired-token stream and slow consumer | No pre-auth content; bounded resource use; safe close/resync; protected reconnect remains available at cutoff. |
| R23 | Duplicate/gap/out-of-order outbox delivery and API restart | Current authorized complete projection/snapshot recovers; no requirement to replay a permanent socket event log. |
| R24 | Host feedback after reveal/finish versus feedback edit/purge | Independent feedback revision, no score/version unlock; purge rejects new edits and invalidates caches. |
| R25 | Runtime directly mutates score history, roster identity or retained pins | Guard/grant rejection, with only documented departure/privacy/purge exceptions. |
| R26 | Original guest proof after live removal/closure | Compact original terminal result only; no live/media/subscription/re-enrollment. Locator alone never works. |
| R27 | Simultaneous last admission reservations and stale metrics | Atomic reservation; no allocation/debit on refusal; new admission pauses after grace; protected work remains bounded. |
| R28 | Capacity refusal followed by accepted-operation retry/reconnect/media renewal | Recover/serve existing entitlement; no mistaken second allocation and no capacity-gate lockout of current games. |
| R29 | Old non-score receipt cleanup followed by old request | No reapplication: durable source lookup or stale expected revision/epoch; no secret returned from receipt. |
| R30 | Category-slot swaps and interrupted full setup save | Complete atomic replacement with unique categories; no partial draft or accidental published content mutation. |
| R31 | Anonymous-to-account binding followed by old proof use | Old game snapshots stay anonymous; new progress begins next game. Retire anonymous live access/stream; retained proof reads only original anonymous compact results. |
| R32 | Older projection/REST query completes after a newer push | Consistent reads, publication fencing and complete source vectors prevent state rollback. Presence has its own epoch and is not overwritten by static views. |
| R33 | New takeover reuses current secret; accepted duplicate retries | Reject new reuse after duplicate recovery; never rotate only generation and silently reactivate an old device. |
| R34 | Deployment drain/restart and overlapping writer attempt | One admitted process or explicitly coordinated handover; rebuild occupancy, preserve durable effects and test protected reconnects before claiming the admission guarantee. |

## Performance and capacity evidence

Use a disposable staging profile matching the intended Railway API/database limits and network region. Record its exact quota/CPU/RAM/pool/runtime/build; media travels directly from Cloudflare. Use representative authored content, all ten formats, 70% image-bearing questions as the earlier planning distribution, signed-in/anonymous mixes and existing progress history. Record changes from that distribution explicitly.

Run 10/25/50/100 full-room stages (six participants each). Initial engineering load profile: two-minute warmup, fifteen-minute steady state, average 0.2 valid host commands/second/room; include bounded catalog/lobby/start/replay churn and a declared burst profile. Report the precise command mix, burst/reconnect rates and expected capacity refusals rather than presenting socket count as throughput. Test actual browser/native-compatible WS framing and R2 audio Range/expiry behavior; installing/building Flutter is excluded.

Accepted targets: p95 server processing <=250ms for accepted gameplay commands and p95 committed state visible <=1 second under the declared healthy-network profile. Report p99, pool/lock wait, CPU/RAM/event-loop delay, cache/projection builds, outbox backlog, queued socket bytes, egress and correctness. Refusals must not disguise failed/slow accepted work.

Stress reconnects, slow consumers, resource-pressure changes and server restart separately. An initial recovery target is >=99% of existing test participants resynchronized within 30 seconds after service readiness, subject to the declared jitter/network profile. Treat that additional engineering budget as a test target, not a result. Verify automatic reopen only after fresh healthy samples/lower threshold; no paid scaling is performed automatically.

Expand beyond 100 only with bounded stop conditions in staging. Record the highest passing envelope, derive the 85% admission budget with actual resource pressure, and ensure the chosen profile can still admit the promised 100-room launch workload. Revalidate after material runtime/resource/payload/workload changes. No test of the current foundation alone establishes this API capacity.

## Commands and artifacts to deliver

Run backend `pnpm check`, `pnpm test`, `pnpm test:database`, `pnpm db:check` and `pnpm build` from `web_app/backend`; exercise database fixtures/migrations only in disposable environments. Run frontend check/build if web application changes are made, as required by root AGENTS. Prototype changes are outside scope; if later explicitly requested, preserve its own check/test/build/deployment requirements. No local mobile build.

Deliver migration/schema parity, restricted-role negative tests, HTTP/WS integration/race reports, schema/contract validation, representative query plans, load/recovery reports with environment identity, operational defaults/alerts/runbook and the new implementation PR. Do not mark production ready while real identity/content/media/quota/metric configuration or agreed load evidence is missing.
