# Gameplay API design session

Opened 2026-11-04 using `grill-with-docs`, `grilling` and `domain-modeling`. Updated 2026-11-06 after Round 3. The deliverable is the complete gameplay REST and WebSocket contract: category/pack selection on the main page, room creation, join/QR sharing, team setup, the shared board/questions/media, host-controlled play/scoring and the final result. Security, performance, retry safety and concurrent transitions are design requirements.

Status: all 19 questions answered; final design package is ready for shared-understanding review. The [gameplay contract](gameplay-contract.md) maps the complete cycle into resources, commands, projections and transaction/recovery rules. Login/OTP, account/profile APIs, checkout/payment providers, unrelated public pages, history browsing and staff content/upload/processing APIs are outside this phase. Current-game results, its existing host Like/Dislike control and permitted image/audio delivery are included. Existing identity/token/content services supply integration boundaries; excluding their APIs does not bypass gameplay authority or the accepted atomic game-start debit. No runtime services, dependencies, migrations or deployment configuration have changed.

Planning documents are on `docs/gameplay-api-design`. The user's implementation rule is recorded in [AGENTS.md](../../AGENTS.md): each agreed implementation change set uses a new branch and a new PR for review before an approved merge to `main`. Do not start implementation or open its PR while the design interview remains open.

Domain definitions live in [CONTEXT.md](../../CONTEXT.md). `Viewer` describes a non-host participant's gameplay permissions; `Guest` continues to describe joining without sign-in. API-Q8 preserves Join/Team/Ready/Leave while gameplay controls/audio remain host-only. API-Q9 accepts recoverable lobby setup.

## Source authority and implemented baseline

Carry forward accepted product decisions rather than reopening the earlier Q1–Q94 database interview. Use current implementation evidence where older design documents describe a proposed or unimplemented schema.

| Source | How it informs this session |
| --- | --- |
| [Implementation status](../database/implementation-status.md) and [ADR 0011](../adr/0011-drizzle-postgresql-foundation.md) | The 39-table Drizzle/PostgreSQL foundation and database integrity tests are implemented. Gameplay, account authentication, media adapters, outbox execution and retention services remain application work. |
| [Actual schema](../../web_app/backend/src/database/schema/index.ts) and [integrity migration](../../web_app/backend/drizzle/0001_postgresql_integrity.sql) | Existing columns, constraints, triggers, permissions and transaction boundaries constrain the new API services. |
| [Requirements](../database/requirements.md), [decision summary](../database/decisions-summary.md) and [domain glossary](../../CONTEXT.md) | Accepted product rules and canonical vocabulary. |
| [Gameplay](../database/gameplay-design.md), [identity/invitations](../database/identity-invitations.md), [lifecycle transactions](../database/lifecycle-transactions.md) and [freshness](../database/pack-freshness.md) | Rules for gameplay commands, accounts, room membership, concurrency, eligibility and progress. |
| [Content/media](../database/content-and-media.md) and [operations/retention](../database/operations-and-retention.md) | Ten question formats, private assets, frozen content, outbox and retention requirements. |
| [Prototype gameplay guide](../../sahsah_prototype/docs/prototype-gameplay.md), [screens](../../sahsah_prototype/src/pages) and [game rules](../../sahsah_prototype/src/lib/game-rules.ts) | Presentation and interaction evidence, subject to accepted production overrides. |

The backend currently uses NestJS 12.3.3, Express 5.3.0, Drizzle 0.45.4 and node-postgres. Its global validation uses `class-validator`/`class-transformer`; Zod and socket/storage adapters are not installed. See [package.json](../../web_app/backend/package.json) and [application.ts](../../web_app/backend/src/application.ts). The phrase “z lib” is provisionally interpreted as **Zod**, the validation library; this does not authorize replacing validation implicitly or changing dependencies during this interview.

## Rules already settled

Global identity, financial, feedback and retention rules below remain existing constraints; they do not expand this phase's endpoint scope.

| Area | Existing contract to preserve |
| --- | --- |
| Room and game | A reusable room holds separate games. Each accepted start/replay creates a game, freezes its roster/content and charges the host one token. Rejected starts charge nothing. |
| People and board | At most six people including the host; two teams; six categories; one six-question pack per category; 36 tiles with 200/200/400/400/600/600 points per category. A host may be neutral and teams need no minimum connected membership. |
| Account identity | Egypt-only verified phone; backend-verified WhatsApp OTP followed by Firebase custom authentication. Clients authenticate API requests with Firebase ID tokens. Staff accounts are separate. |
| Guest identity | Anonymous participation is allowed. Six-digit invitation codes and QR/share links locate a room; private reconnect credentials recover anonymous memberships. A name/code/device identifier is not recovery authority. |
| Admission and replay | Invitations last 24 hours independently of game expiry. Roster/team identity freezes at start. Newcomers wait for the next game; non-host members confirm Ready again for each start. Viewers retain their pre-start team/Ready and explicit Leave actions. Draft lobby selection/team setup survives refresh and host takeover. |
| Host authority | One controlling device, fenced by current secret and increasing generation. The same host may take over; there is no transfer to another host account. Only the host opens/reveals/adjudicates/changes scores or plays question audio. Other participants are viewers. No answer submission or buzzer engine is in scope. |
| Content and progress | All ten formats; Arabic required, optional Franco fallback; mixed-format packs. Group freshness uses the tracked signed-in roster. Repeats require explicit acceptance. Completion requires six resolutions within one game. |
| Clocks | Ordinary opening starts 60 seconds automatically. Memory viewing is untimed; first hide starts the answering timer. Revisits do not restart it. Reset of an already-started answering clock immediately runs a fresh 60 seconds. Reopening resumes navigation-paused time and preserves intentional host pause. Timeout does not reveal or resolve. |
| Scoring and finish | Suggested points follow the current hint stage; awards are bounded by the original tile value. Nonnegative total corrections preserve original awards. Resolution 36 or deliberate ending locks scores. |
| Departure and recovery | Temporary disconnect preserves participation/progress eligibility. Explicit departure stops future credit. Host End/Leave ends the game for everyone. A game expires after 24 elapsed hours without meaningful host gameplay activity. |
| Tokens | Accepted start debits once. Resume/reconnect/takeover are free. An unopened terminal game restores its original debit once; opening is sticky. Verified unrecoverable platform failures use the existing audited support policy. |
| Feedback and history | Host feedback is editable after reveal while copied content is retained. Original content/media is retained for 12 months after ending; compact results/progress/votes survive its purge. |
| Deployment | Initially one NestJS process and one writable PostgreSQL service. No Redis, separate worker service, replica or offline multiplayer is selected. Web and Flutter use the same API. |
| Durability and fanout | PostgreSQL owns accepted state. REST command effects and small outbox hints commit together. The dispatcher pushes permitted host/viewer updates after commit; initial connection/gaps/reconnect use authorized snapshots. Projection work is bounded and shared without replacing current authority checks. Presence is disposable; no per-second database timer writes. See [ADR 0012](../adr/0012-rest-commands-and-gameplay-push.md). |
| Files | Private Cloudflare R2 holds/delivers gameplay bytes. PostgreSQL stores immutable asset identities, metadata and relational pins. Original/answer media requires phase-appropriate authorization. Expiring URLs may remain valid briefly after authority changes, as accepted in API-Q4; viewers never receive audio access. See [ADR 0013](../adr/0013-private-r2-gameplay-media.md). |
| Admission | API-Q7 accepts 100 full rooms/600 players as the initial acceptance workload, with p95 server command processing <=250ms and p95 visible state propagation <=1 second under defined conditions. Refuse new load at 85% of capacity while preserving existing-game work/reconnect/media. Missing required fresh measurements pause new admission after a bounded grace period; healthy recovery reopens it. Scaling stays operator-controlled. Effective limits and safe capacity are unmeasured. See [admission control](admission-control.md). |
| Media failure | Host media failure offers Retry and explicit host Pause without automatic timer reset, question replacement or new debit. Viewer loading failures affect that viewer only. Preserve frozen content and accepted opening/exposure/timer milestones. |

## Prototype differences to account for

- LocalStorage, browser Web Locks, storage events and 600ms polling simulate persistence and synchronization. The optional service client uses SSE, not a production WebSocket implementation. Cross-device QR fallback can create an unrelated preview game. See [demo service](../../sahsah_prototype/src/demo/service.ts) and [API client](../../sahsah_prototype/src/lib/api.ts).
- Four-digit codes, loose guest lists and session-ID-only reads are presentation-era mechanisms. Apply the accepted room, membership, admission and recovery rules instead.
- Guest screens mirror gameplay visuals, but actual audio output exists only on the host. API-Q2 explicitly preserves host-only audio and passive viewer gameplay. Unlike the prototype, viewer payloads must omit audio URLs and host capabilities instead of hiding their controls in React. See [QuestionAudio](../../sahsah_prototype/src/components/QuestionAudio.tsx).
- Some future prompts/media already appear in whole-board DTOs, and person/color images conceal delivered originals with CSS. Production projections must omit unopened content and unauthorized assets; serve appropriate image variants. See [game DTO construction](../../sahsah_prototype/src/lib/game-rules.ts) and [PartyQuestion](../../sahsah_prototype/src/components/PartyQuestion.tsx).
- Accepted production behavior changes prototype back-navigation, replay and finished-score correction. The server, rather than a React effect, establishes authoritative timer deadlines.

## Transaction findings for the contract specification

These are engineering obligations, not questions to delegate to the product owner.

- Use actual schema guarantees: [game question checks](../../web_app/backend/src/database/schema/games.ts) already enforce `awarded_points <= base_points`. Older prose claiming only a broad 600-point database cap is stale. Services still validate authority, valid transitions and score/progress coherence.
- [Game command receipts](../../web_app/backend/src/database/schema/games.ts) already include command identity/digest, expected/result versions, actor and controller generation. The API must specify authentication before receipt replay, duplicate lookup before stale-version rejection, same-key/different-payload conflict and retention behavior. A retry must neither apply a second effect nor renew activity.
- State versions, controller generations and team totals use JavaScript `bigint`; define an exact JSON representation rather than accidentally serializing or truncating them.
- Build the complete lock order from triggers as well as service code. The [membership trigger](../../web_app/backend/drizzle/0001_postgresql_integrity.sql) acquires the room row on every membership insert/update. Updating a membership after locking a game can therefore violate the documented no-game-to-room order. Explicit departure, start, cleanup and replay must use a coherent ordering.
- Recheck fresh time, game state, membership and controller authority after locks. Commit authoritative effects and outbox work before returning success or delivering newly exposed content. Keep provider calls, socket I/O and media processing outside those locks.
- Define invariant-based integration/race tests for duplicate starts, last-token starts, last room seat, readiness/start changes, takeover versus stale commands, duplicate resolution, open versus end/expiry, media authorization, explicit departure, snapshot recovery and retained-media collection. Existing database races establish selected SQL protections, not the full application behavior.
- The room schema has a Ready generation but no general room version, durable lobby selection or generic lobby command receipts. Do not treat a Ready generation as a concurrency token. API-Q9 accepts draft-selection persistence; design the necessary narrow schema changes before implementation rather than inventing an unpaid `games` row.
- A cache keyed only by `(game, state_version)` is insufficient for all data: terminal version is immutable while later feedback/purge can change retained content. Room changes, membership/controller validity, media expiry and server time also need current handling. Cache a bounded safe core with explicit invalidation and late authority/media checks, not a reusable authorization decision.

## Round 1 decisions, 2026-11-05

| Question | User answer and resulting decision |
| --- | --- |
| API-Q1 | Narrow the phase to the gameplay cycle, category/pack selection through final results and mirrored views. Auth/payment/other pages are excluded. Consume existing verified identity, bank and published-content boundaries without designing those feature APIs. |
| API-Q2 | Host alone operates gameplay and audio. Other participants are viewers. Preserve permitted visuals; omit audio access from viewer responses. API-Q8 confirms existing lobby self-actions remain. |
| API-Q3 | User delegates the most efficient design. Select REST mutations and committed WebSocket projection updates with shared bounded projection work and snapshot recovery; [ADR 0012](../adr/0012-rest-commands-and-gameplay-push.md) records the refinement over per-event client fetches. Performance must be measured. |
| API-Q4 | Accept private R2 and short-lived presigned access, including bounded reuse after authority changes. [ADR 0013](../adr/0013-private-r2-gameplay-media.md). Initial engineering TTL/renewal is 300/60 seconds, to validate in staging. |
| API-Q5 | Accept immediate Reset-and-run and navigation-pause versus deliberate-pause reopening behavior. Updated [gameplay design](../database/gameplay-design.md). Memory's first-hide rule is preserved. |
| API-Q6 | Reject stale/unavailable/non-fresh selected packs without a debit, propose eligible replacements and require confirmation. No silent substitution or transfer of repeat consent to a different roster/content. |
| API-Q7 | Accept the proposed 100-room/600-player, <=250ms processing and <=1-second propagation targets. Add measurement of actual deployment capacity, an 85% admission threshold and a capacity message for refused new load; operator may increase capacity or leave admission paused. API-Q10/Q11 settle cutoff/recovery policy. |

The user also requires every implementation change set to use a new branch/PR before review and merge. This is a workflow requirement, not a domain-model term.

## Round 2 decisions, 2026-11-05

| Question | User answer and resulting decision |
| --- | --- |
| API-Q8 | Yes: preserve viewers' Join/Team/Ready/Leave rights. Gameplay controls and all question audio remain host-only. |
| API-Q9 | Accept durable, versioned draft lobby selections/team setup that survives host refresh/takeover. The focused schema extension is specified in the package; no schema migration has been written. [ADR 0014](../adr/0014-recoverable-lobby-setup.md). |
| API-Q10 | Accept refusal of new rooms, game starts/replays and guest seats at cutoff, before allocation/debit. Continue existing-game commands, finish/leave, authorized reconnects, accepted-operation recovery and permitted media delivery. Return 503 SERVER_AT_CAPACITY with Retry-After for refused new allocation. |
| API-Q11 | Accept pausing new admissions after required measurements become stale/unavailable beyond a bounded grace period. Preserve existing games; reopen after fresh healthy measurements and a lower recovery threshold. Operator chooses resource increases; no automatic paid scaling. [ADR 0015](../adr/0015-protect-active-games-at-capacity.md). |
| API-Q12 | Accept Retry and explicit host Pause for host media failure. No automatic pause/reset/replacement/debit. A viewer loading failure affects only that local display. |

## Round 3 decisions, 2026-11-06

| Question | Accepted recommendation |
| --- | --- |
| API-Q13 | Category/pack/repeat-consent, roster and team-assignment changes invalidate all non-host Ready confirmations. Cosmetic names, invitation rotation, refresh, presence and same-host takeover preserve Ready. |
| API-Q14 | Every current non-host must be Ready for Start; otherwise reject with the unready members identified. Host may explicitly remove them before retrying. |
| API-Q15 | One reusable nonclosed room per host. Explicitly close it before creating another; preserve completed results. |
| API-Q16 | Close an inactive lobby after 24 elapsed hours of meaningful lobby inactivity. Suspend that rule while a game is active; begin a fresh lobby window from its effective end time. Invitation expiry is independent. |
| API-Q17 | One live stream per participant. Authorized reconnect replaces the prior stream without another seat. Host control acquisition remains explicit. |
| API-Q18 | Host disconnect does not pause the answering deadline. Reconnect restores actual remainder; explicit Reset remains available. Timeout does not reveal or resolve. |
| API-Q19 | Manual target input is 0–1,000,000. Subsequent legal question awards may exceed that input ceiling. Preserve exact decimal-string totals/versions. |

The product frontier is empty. Concrete HTTP/realtime/schema/lifecycle/admission/acceptance specifications and structural validation are complete; the user supplied final confirmation by invoking `$implement`; runtime work is on `feat/gameplay-api`.

## Design tree

| Branch | Prerequisites | Current state |
| --- | --- | --- |
| Gameplay-only scope, host-only controls/audio | API-Q1/Q2/Q8 | Accepted, including lobby self-actions |
| REST mutations, committed push and snapshot recovery | API-Q3 | Selected under delegated engineering judgment; ADR 0012 |
| Private R2 media | API-Q4 | Accepted; ADR 0013; TTL/renewal specified as tunable staging defaults |
| Timer reset/navigation/media failure | API-Q5/Q12 | Accepted |
| Stale pack rejection/reconfirmation and lobby persistence | API-Q6/Q9 | Accepted; ADR 0014 |
| Launch targets and 85% admission | API-Q7/Q10/Q11 | Accepted policy; ADR 0015; limits/freshness/reservations specified; real capacity unmeasured |
| Detailed lobby DTOs/concurrency/start validation | API-Q8/Q9 | Specified in OpenAPI and transaction plan |
| Admission reservations, overload errors and recovery | API-Q10/Q11 | Specified in admission plan |
| Question/media transitions and errors | API-Q12 and fixed timer rules | Specified in question lifecycle and schemas |
| Ready invalidation and unready members | API-Q8/Q9/Q13/Q14 | Accepted |
| Open-room multiplicity and inactive lobby lifetime | API-Q15/Q16 | Accepted; ADR 0016 |
| Simultaneous live screens and host disconnect | API-Q17/Q18 | Accepted |
| Manual correction input limit | API-Q19 | Accepted |
| Wire representation, transport/validation libraries, error format and snapshot recovery | Delegated engineering choices | Specified; native Nest 12 schema support verified locally |
| Meaningful activity, exact fields/limits, schema/transaction appendix and acceptance scenarios | Round 3 policies and settled lifecycle | Specified and structurally validated |
| Integration/race/load acceptance matrix and implementation handoff | Complete agreed contract | Written; runtime execution belongs to implementation/staging |

## Round 1: historical prompts

API question numbers below are separate from the earlier database Q1–Q94. These preserve the questions and recommendations shown to the user; the decision table above is authoritative for their answers.

### API-Q1: Contract boundary

Should this contract cover home/catalog reads, player authentication prerequisites, profile/token summaries, room/invitation/readiness, gameplay, feedback, history/results and protected media delivery? Should it also include staff upload/transformation/publishing and purchase-provider APIs?

Recommendation: fully specify gameplay and its customer-facing prerequisites; specify the ready-catalog/token-bank integration boundaries. Staff authoring/media ingestion and purchase-provider workflows remain separate contracts unless explicitly included in this design round. This does not remove those accepted application features.

### API-Q2: Location and audio experience

Does launch preserve the prototype's shared host-screen/audio experience, or must guests joining from another location hear host-controlled question audio on their own devices?

Recommendation: preserve mirrored guest visuals with host-device audio as the baseline. If remote audio is required, include it explicitly before defining playback state, per-device opt-in, synchronization expectations and failure handling. Host authority and unlimited replay remain unchanged either way.

### API-Q3: Mutation transport

Should lobby and gameplay mutations use REST while WebSockets notify clients of committed version changes, or should socket messages also accept business commands?

Recommendation: REST mutations with durable operation identities and expected versions; authenticated sockets for committed-change notifications/presence, with authorized REST snapshots for synchronization. Preserve one command implementation and the existing outbox direction. Socket library selection follows this decision.

### API-Q4: Previously issued private media access

Is it acceptable that a legitimately issued image/audio URL can be reused for a short bounded period after membership/control changes, or must every subsequent fetch check current authority?

Recommendation: private R2 objects and short-lived presigned reads, issued only for permitted assets/phases. Never issue future answers or hidden originals. Select the TTL and renewal rules during the media branch. If current-authority checks on each fetch are required, design an authenticated edge path explicitly; already downloaded content cannot be recalled.

### API-Q5: Reset and navigation

For an answering clock that has already started, should Reset restore 60 seconds and run immediately? When reopening an unresolved question, should a clock paused by navigation resume while an intentional host pause remains paused?

Recommendation: yes to both. Preserve memory's first-hide prerequisite and retained hints/reveal state. These exact interactions are marked as unresolved interpretations in [gameplay-design.md](../database/gameplay-design.md).

### API-Q6: Stale lobby selection

If a selected pack becomes unavailable or no longer group-fresh before Start is accepted, should the server silently substitute a pack or return eligible alternatives for host confirmation?

Recommendation: reject that start without a token debit and return actionable replacement information. Revalidate the final roster/catalog and obtain any required repeat consent before accepting the next start attempt.

### API-Q7: Launch acceptance target

Should the initial acceptance workload target 100 full rooms/600 players, with p95 server command acknowledgement below 250ms and p95 committed-change visibility below one second on an agreed healthy test network? Different targets must be stated before claiming production readiness.

Recommendation: use these as proposed measured acceptance targets, test progressively at 10/25/50/100 rooms, and include restart/reconnect and correctness tests. Exclude media transfer and external OTP/provider latency from the command-acknowledgement metric; measure them separately. Specify command mix, load bursts, test duration and resource envelope in the performance branch. The earlier [capacity model](../database/single-instance-capacity.md) is an estimate, not proof.

## Round 2: historical prompts

All five recommendations below were accepted; the decision table above is authoritative.

### API-Q8: Viewer lobby and participation actions

Does “viewers cannot interact” apply to gameplay controls while retaining Join, pre-start team choice, Ready and explicit Leave, or should the host also control team choice/readiness?

Recommendation: keep viewers passive during gameplay and retain their previously accepted Join/Team/Ready/Leave actions. These never open questions, play sound, alter clocks or award points. If the user intends host-managed lobby choices, record that as an explicit revision to earlier Q59/Q70/Q74.

### API-Q9: Recoverable lobby selection

After a room is created, should its selected categories/packs and team setup survive host refresh/device takeover and stay synchronized for its participants?

Recommendation: yes, persist and version the room's draft setup; preserve current eligibility revalidation at accepted Start. The actual schema does not store draft category/pack choices or a general lobby version, so document a focused schema extension before implementing it. An accepted paid game is not an unpaid lobby draft.

### API-Q10: Admission cutoff and existing games

At the 85% cutoff, should the system refuse new rooms, new game starts/replays and new guest seats while allowing already-admitted participants to continue, reconnect, finish and receive media?

Recommendation: yes. Protect existing work with bounded queues/reconnect budgets and refuse additional reservations before token debit or seat creation. Cached category/pack browsing can remain available. Refused new load receives `503 SERVER_AT_CAPACITY` with Retry-After and a friendly localized message. A recovered retry of an already accepted operation is not new admission. See [admission control](admission-control.md) for the proposed engineering mechanism.

### API-Q11: Missing pressure measurements

If required fresh pressure measurements are unavailable beyond a bounded grace period, should new admissions pause until measurements recover, or proceed using the last known reading?

Recommendation: pause new admissions while preserving existing-game work and recovery. An admission monitor outage must not revoke seats/end games. Railway dashboard lag alone need not pause admission if an independently valid local/tested signal set remains available; define the required signals and freshness windows in the contract. Reopen automatically after recovery below the configured lower threshold. Paid scaling remains an operator decision.

### API-Q12: Host media-loading failure

If the host opens a question and its image/audio fails to load, should it remain on the same question with Retry and host Pause controls, or should a load failure automatically pause the game?

Recommendation: Retry plus explicit host Pause; viewer loading failures affect only their local display. Preserve the accepted server opening/timer/exposure milestones, with no automatic question substitution, fresh token debit or timer reset. Recovery reloads the same frozen content; terminal restoration still follows the existing policy.

## Round 3: historical prompts

All seven recommendations below were accepted on 2026-11-06. The decision table above is authoritative.

### API-Q13: Setup changes after Ready

Everyone is Ready, then the host changes a category/pack or someone changes team. Should those confirmations still count?

Recommendation: invalidate all non-host Ready confirmations after category/pack/repeat-consent, membership-roster or team-assignment changes. Preserve Ready after cosmetic names, invitation rotation, refresh, presence changes or same-host takeover. Bind repeat acceptance to the actual content/roster, independently revalidating freshness at Start. A new Ready epoch handles meaningful setup changes without rewriting every member row.

### API-Q14: Unready members when starting

If one current lobby member is not Ready, should Start wait or silently leave that member outside the game?

Recommendation: reject Start with the unready members identified until they confirm Ready or the host explicitly removes them. Do not introduce unconfirmed spectators outside the frozen playing roster. Recheck under the room lock so Ready/join/start races have one outcome.

### API-Q15: Open rooms per host

Can the same host keep several unpaid rooms open, or one reusable open room?

Recommendation: one open room per host. Recover/reuse it; explicitly close it before creating another, preserving completed games/results. The already accepted one-active-game-per-account rule remains separate. A repeat request recovers its exact original room rather than silently applying a different setup to it.

### API-Q16: Inactive lobby lifetime

How long should an unpaid or between-games lobby remain recoverable without meaningful activity?

Recommendation: 24 elapsed hours of meaningful lobby inactivity, with an independent deadline. Never close its room through this idle rule while a game is active; begin a fresh lobby window after that game ends. Reads, heartbeats and reconnects do not renew it. Invitation expiry remains independent and does not itself delete saved setup; terminal game/results remain retained after room closure.

### API-Q17: Extra live screens

Should one participant be able to maintain several simultaneous live screens/tabs, or should a new authorized connection replace its previous stream?

Recommendation: one live stream per participant, with authenticated reconnect replacing the previous stream without taking another seat. Host controller takeover stays explicit; another tab must not silently acquire gameplay/audio authority. This bounds the six-player room's connection budget. No extra spectator/display seats are assumed.

### API-Q18: Host disconnect during the clock

If the host disconnects while the answering timer runs, should it continue or automatically pause?

Recommendation: keep the authoritative deadline running, show the connection status and restore the actual remaining time on reconnect. Presence alone never changes the timer; expiry still does not reveal/resolve. The host can explicitly Reset after recovery.

### API-Q19: Manual score input ceiling

Should a host's manual target total be limited to 0–1,000,000, matching the prototype input's intended range, or use a different limit?

Recommendation: 0–1,000,000 for manual target input. This is not a question-award cap or a hard resulting-total cap: later valid awards can increase the total beyond it and must never fail for that reason. The full board has 14,400 possible awarded points; totals/versions use exact decimal-string transport. This avoids inheriting the prototype engine's inconsistent delta-only check.

## Primary-source checks

Checked 2026-11-04 for the initial recommendations, without installing libraries or contacting configured providers. Railway sources were checked again on 2026-11-05 in [admission control](admission-control.md).

- Nest documents [Zod-backed validation pipes](https://docs.nestjs.com/pipes#object-schema-validation). Zod validates the input contract; authorization, legal transitions and transactional invariants remain separate application responsibilities. The installed stable Drizzle line must be respected when considering generated validators; raw table insert schemas are not automatically appropriate public request DTOs.
- Socket.IO documents ordered delivery but default at-most-once arrival and [application-level delivery work](https://socket.io/docs/v4/delivery-guarantees/). Its [connection recovery can fail](https://socket.io/docs/v4/connection-state-recovery/), so durable snapshots/revalidation remain necessary if it is selected. API-Q3 selects the REST/WebSocket boundary, not a particular socket library.
- Cloudflare's [R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/) are reusable bearer credentials until expiry and work on the S3 endpoint, not custom domains. Private custom-domain caching therefore requires a separately designed authorization layer; hiding an object name is insufficient.
- [OWASP WebSocket security guidance](https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html) informs explicit origin policy, authentication/session lifecycle, per-operation authorization, bounded input/connection work and secret-safe logging. Final controls and tests belong to each applicable contract.

Additional 2026-11-05 checks are recorded in [the gameplay contract](gameplay-contract.md). Installed Nest 12.3.3 already contains native Standard Schema validation and serialization; use those with compatible Zod/native OpenAPI support. The delegated transport design selects native WebSockets through Nest's WsAdapter, with bounded application-level authentication, heartbeat, backpressure and snapshot recovery; no Socket.IO dependency or unverified bridge is needed by this design.

## Interview record

All three rounds are recorded above; the glossary and ADRs capture their settled terms/trade-offs. The [package index](README.md), [OpenAPI](openapi.json), [realtime schema](realtime.schema.json) and [validation report](validation-results.json) are ready for final shared-understanding review. No Railway capacity measurement or load test has run; no runtime implementation, remote PR or merge has been created during planning.

Implementation status: the user invoked `$implement` after the final accepted recommendations. See [implementation evidence and operations](implementation-and-operations.md) for current runtime work, local verification and outstanding release prerequisites. Earlier evidence tables describe the planning baseline.
