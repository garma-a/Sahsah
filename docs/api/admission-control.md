# Gameplay admission and Railway capacity

Updated 2026-11-06. API-Q7 accepts an initial 100-full-room/600-player acceptance workload with p95 command processing <=250ms and p95 visible committed updates <=1 second under defined test conditions. The user additionally requires admission to stop at 85% of capacity, with a capacity message for new load and operator-controlled scaling.

API-Q10/Q11 accepted the protected-operation and missing-measurement policies on 2026-11-05; [ADR 0015](../adr/0015-protect-active-games-at-capacity.md) records the trade-off. Mechanism/tuning details below remain to be specified and measured. No production quota, workload, capacity or monitoring freshness has been measured; no load tests or deployment changes have run.

## Define the denominator

“Railway max” is not one application capacity value. Identify the exact API and PostgreSQL deployments and their effective per-replica CPU/memory limits. Railway's [plan table](https://docs.railway.com/pricing/plans) includes replica multiplication; [service replica limits](https://docs.railway.com/pricing/cost-control) can constrain the individual container further. Account spend thresholds are not resource-utilization controls.

Measure a gameplay capacity envelope for that exact deployment profile: the highest tested workload that maintains the agreed latency/correctness criteria under a declared command mix, bursts, reconnects and background work. Record API and database bottlenecks independently. The initial 100-room target is neither a measured maximum nor an instruction to reject at room 85.

Recommended admission checks, with exact windows/budgets selected from measurements:

| Signal | Meaning and admission effect |
| --- | --- |
| API CPU and memory versus effective limits | Close new admission at sustained >=85% utilization; a sudden critical memory condition closes immediately. A single busy event-loop thread can saturate before aggregate CPU reaches 85%, so use application signals too. |
| Database CPU and memory versus effective limits | Independently close on sustained >=85% pressure using defined, fresh samples; API headroom does not establish database headroom. Specify memory accounting rather than mixing RSS, working set and cache-inclusive values. |
| Tested room/player/socket/command envelope | Bound admitted load and transient reservations to the validated profile, with the requested headroom. Room/player counts are distinct from socket counts and concurrent in-flight commands. |
| Event-loop delay, pool wait/queue and command latency | Close earlier when application saturation appears even below CPU/memory thresholds. Bound pending work instead of letting queues grow until memory is exhausted. |
| Metric freshness, configured limits and monitor state | Use current timestamped measurements with a defined required signal set. Missing/stale required signals enter a bounded warmup/unknown state and pause new admission after the grace period, as accepted in API-Q11. |

Use separate open/close thresholds and a healthy recovery interval to prevent admission rapidly switching on/off. A lower reopening point around 75% is an initial candidate, not an accepted tuning result. Applying 85% to an empirically tested room budget as well as resource pressure requires the final resource profile to still support the accepted launch workload; do not quietly promise 100 admitted rooms while configuring an 85-room cap.

## Protect the gameplay already admitted

Accepted API-Q10 policy:

| Operation | At ordinary admission cutoff |
| --- | --- |
| New room, new game/replay, new guest membership | Refuse new allocation before its side effects and before any token debit. Bound the cost of rejected requests. |
| Retry of an already accepted create/join/start/command | Recover its existing result after current authority checks; it does not allocate a second room, seat, game or token debit. |
| Existing game's authorized host commands, finish and explicit leave | Continue within a protected, bounded work budget. The cutoff does not end a game or take its controls away. |
| Existing participant refresh/reconnect/controller recovery | Preserve existing membership/game, with bounded credential checks, connection replacement and reconnect rate/burst handling. A credential must not create unlimited tabs/sockets. |
| Existing game's allowed media access/renewal | Continue authorization/URL issuance; bytes travel directly from Cloudflare. Viewers never receive question audio. |
| Category/pack browsing | Serve bounded public/cacheable data where possible, while rejecting unaffordable uncached work under severe pressure. Browsing does not reserve a room or guarantee a later start. |

Admission checks must cover creates, starts/replays, joins and subscriptions consistently, including concurrent calls. Use atomic transient reservations before asynchronous allocation; release on failure and reconcile committed occupancy. After a process restart, rebuild authoritative game/membership occupancy before reopening admission. An in-memory capacity check alone does not prevent several simultaneous last-slot admissions.

Use a measured capacity vector for open room/membership entitlements, active games, current streams and in-flight work. Create reserves one room plus host entitlement; Join reserves one membership/reconnect entitlement; Start reserves one active-game allocation, accounting for its already admitted frozen roster. One stream per member uses that entitlement rather than allocating another seat; short handover/auth overlap has a separate bounded budget. Use the same operation-scoped transient reservation for concurrent duplicates and release it after commit/reconciliation or rollback. Do not double-count existing seats as new load at Start/reconnect.

API-Q15/Q16/Q17 fix one open room per owner, 24-hour effective idle lobby closure and one live stream per participant. Rebuild live entitlement/game counts from authoritative rows before new admission opens. No PostgreSQL capacity table or Redis service is selected. Game end releases active-game budget; live lobby/result membership entitlements remain until departure/closure, with dead sockets removed from actual-stream counts.

This process-local scheduler assumes one admitted API process, including deployment. Use a controlled drain/restart with bounded in-flight completion and occupancy rebuild; verify the Railway deployment procedure does not leave independently admitting old/new writers. A rolling overlap or future replica requires a fenced/coordinated admission/fanout design before enabling it. Existing PostgreSQL source/row guards still protect durable effects; local counters alone are not a multi-process quota.

## Initial engineering configuration

These defaults are explicit starting points for staging, adjustable through validated deployment configuration. None is a measured Railway limit.

| Setting | Default / rule |
| --- | --- |
| API resource sample | Every 1 second; maximum age 5 seconds, using effective container limit and process/cgroup measurements |
| Database resource sample | Every 5 seconds; maximum source age 30 seconds. A real timestamped DB container/OS/provider sample is required; pool stats/SELECT1 cannot substitute. |
| Missing required samples | New admission pauses after 15-second grace; startup starts paused until fresh samples and occupancy are restored |
| Resource close / reopen | Close on observed >=85% pressure or earlier tested application saturation; reopen only <=75% across required signals for 30 continuous seconds |
| Refusal retry hint | Initial Retry-After 15 seconds; clients add bounded jitter; preview is advisory |
| New expensive Start work | Initial maximum 1 concurrently; new work uses only unreserved scheduling capacity |
| Database work scheduling | Stay within configured pool; reserve a protected share for existing-game work, bound all queues, and run background work only within spare budget. Tune shares/queue bounds from the declared workload. |
| Certified load ceilings | Derived from actual staging results with requested headroom; configured profile must still admit the 100-room acceptance workload |

Missing/stale metric grace never overrides a known high-pressure sample. Escalate sudden critical memory/event-loop/pool saturation immediately, even before the ordinary85% gate. Validate samples/limits/units and their timestamps; management/dashboard collection never runs on individual gameplay requests.

Capacity refusal should use a stable `SERVER_AT_CAPACITY` reason, HTTP 503 and Retry-After, with localized UI copy such as “We're temporarily at capacity. Please try again shortly.” Use 429 separately for caller-specific abuse/rate limits. Rejected admission has no room/seat/game/token side effect; an availability preview is advisory and the actual admission check remains authoritative. Prevent automatic tight-loop retries with bounded delay/jitter. Publish no provider credentials or internal pressure detail to the client.

## Keep pressure checks cheap

- Sample/evaluate pressure periodically and expose a bounded local admission state. Never call Railway's management/metrics API or run a heavy SQL query for every gameplay request/heartbeat.
- Capture the effective deployment limits/configuration through controlled provisioning or a separately authorized read-only deployment inspection. Railway documents [service management APIs](https://docs.railway.com/integrations/api/manage-services); verify their actual response shape before depending on it.
- Prefer current container/process/application measurements for fast signals. PostgreSQL OS-level pressure requires a defined provider/exporter source; a successful `SELECT 1` cannot supply database CPU/RAM usage. Keep required sample freshness and a safe fallback explicit.
- [Railway metrics](https://docs.railway.com/observability/metrics) and [CLI metrics](https://docs.railway.com/cli/metrics) provide operational visibility, but the checked docs do not promise a maximum ingestion delay. Dashboard polling or best-effort alert webhooks alone are not a synchronous admission gate.
- Keep process liveness/database readiness separate from admission state. Railway's [deployment health check](https://docs.railway.com/deployments/healthchecks) is not ongoing overload admission control.

## Measurement and release evidence

1. Record the real region, runtime, API/database resource limits, database settings, pool cap, representative content/media distribution and baseline resource usage. Keep credentials out of the report. Verify web/mobile client network assumptions without installing or building Flutter.
2. Run the complete implemented flow in staging using real database transactions and socket subscriptions. Ramp through 10/25/50/100 rooms and expand only while the declared stop conditions remain satisfied. Include a realistic mix of catalog/setup, joins, starts, question transitions, pause/reset, scoring and finish; no media bytes should transit NestJS.
3. Add bounded bursts and reconnect/restart recovery, slow consumers and representative background work. Measure p95/p99 command latency, visible propagation, memory, event-loop delay, database pool wait, query/lock time, fanout bytes and error/correctness outcomes.
4. Record the highest passing envelope and admission thresholds for that resource profile. Keep correctness failures separate from expected capacity refusals; expected refusals do not excuse slow accepted-game commands.
5. Verify simultaneous threshold crossings, last available reservations, rejected-start zero debit, lost-response recovery at cutoff, protected reconnects and release of failed reservations. Verify that healthy capacity recovery reopens admission without a retry storm.
6. Revalidate after materially changing CPU/RAM, database/pool, game payloads or workload. Operators may increase configured resources or keep new admission paused; no automatic paid plan/replica change is authorized by this requirement.

Admission headroom reduces avoidable overload; a single API/database still has failure modes such as a process crash or infrastructure outage. Durable state and reconnect recovery remain required. Railway's advertised [connection/RPS limits](https://docs.railway.com/networking/public-networking/specs-and-limits) constrain networking but do not establish safe game capacity. Its billing hard limit can take workloads offline, so it cannot implement the desired preserve-existing-games policy.
