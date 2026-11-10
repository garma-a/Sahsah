# Gameplay API contract

Review baseline 2026-11-06. All nineteen product questions in [the design session](design-session.md) are accepted. The design is documented for final shared-understanding review; no API or migration has been implemented. Planning remains on `docs/gameplay-api-design`; implementation needs a new branch/PR after confirmation.

Exact fields, limits, responses and operation IDs are in [OpenAPI](openapi.json). [Realtime framing](realtime-protocol.md), its [JSON Schema](realtime.schema.json), [schema/transactions](schema-and-transactions.md) and [acceptance/handoff](acceptance-and-handoff.md) complete the package.

## Boundary

Cover category/pack selection, room creation, invitation/QR sharing, lobby setup/readiness, accepted game start, host-controlled questions/audio/timers/scoring, its existing Like/Dislike control, passive viewer mirroring, recovery and current-game results. The same contracts serve web and Flutter. Do not add login/OTP, profile, checkout/provider, staff authoring/upload, unrelated public pages or history-browser APIs.

Consume an already verified local-account principal for host operations, an existing token bank and published ready content/media. Room membership/reconnect/controller proofs are gameplay authority and must still be enforced. Requesting an account ID, room UUID or invitation code alone never proves authority. A fixture principal may support explicit test composition; production must reject missing/unverified authority.

## Wire conventions and validation

- Use `/api/v1` for the new HTTP surface; existing unversioned health/AdminJS entrypoints retain their purpose.
- UUIDs identify rooms, memberships, games, categories, packs and operations. Six-digit invitation codes are strings, preserving leading zeroes.
- Serialize database bigint revisions, controller generations and score totals as unsigned decimal strings with explicit bounds. Small counts, board positions, timer remainder milliseconds and per-question award points are bounded JSON integers. Timestamps are UTC RFC 3339 strings; display formatting is client-local.
- Accept only explicitly defined properties. Use strict discriminated schemas for actions and all ten question formats, with bounded strings, arrays and object sizes. Reject ambiguous scalar query parameters and arbitrary nested JSON.
- Use native Nest 12 `StandardSchemaValidationPipe` for Zod input schemas and `StandardSchemaSerializerInterceptor` with explicit output schemas for HTTP responses. Validate manually published socket messages with those same output schemas; handler interceptors do not cover arbitrary socket sends. Preserve existing class validation where still required.
- Derive request/response OpenAPI from native Nest/Swagger Standard Schema support with a verified compatible Zod version. Respect stable Drizzle 0.45.4; a table insert schema is not a public gameplay DTO. No dependency has been installed by writing this design.

## HTTP inventory

All room/game reads are authorized projections, never raw table rows. Paths below are relative to `/api/v1`; OpenAPI is the machine-readable field contract. Conditional authority requirements are also enforced by the service; schema validation alone is not authorization.

| Method and resource | Audience and behavior |
| --- | --- |
| `GET /categories` | Bounded published category summaries and permitted cover images; no question/answer payloads. |
| `GET /categories/{categoryId}/packs` | Published pack summaries, stable numbering/revisions and requester progress where authorized. Optional `freshOnly=true` filters for the tracked roster; `limit=1` supplies its first fresh default. Room context requires current host proof and never exposes others' raw histories. |
| `GET /gameplay/availability` | Cheap advisory open/paused admission state, without exact internal occupancy/quotas or a capacity reservation. |
| `GET /rooms/current` | Verified owner finds its open room after refresh/new-device access; no control transfer or history browser. |
| `POST /rooms` | Host creates its one recoverable unpaid open room and initial setup. Repeated accepted creation recovers the same source room. New allocation obeys admission control; a different creation while a room is open returns an actionable conflict. |
| `GET /rooms/{roomId}` | Current permitted room/lobby projection, general revision, Ready generation and relevant current-game pointer. Does not issue host credentials to viewers. |
| `PUT /rooms/{roomId}/setup` | Host replaces the bounded draft category/pack choices and team setup using an expected room revision. Start still revalidates final catalog/roster/content. |
| `POST /rooms/{roomId}/lobby` | Host explicitly moves terminal-result focus to replay lobby, preserving the old game/history and allowing fresh Ready. Works with identical next-game selections. |
| `GET /rooms/{roomId}/invitation` | Host gets the current code, expiry and canonical join URL. Clients generate QR graphics from the URL; no screen/video streaming or server-side QR image storage is required. |
| `POST /rooms/{roomId}/invitation/rotations` | Host atomically rotates code/window with retry safety. Existing memberships remain valid. |
| `GET /room-invitations/{code}` | Rate-limited pre-admission preview: validity, joinability, team labels and capacity information only. No roster secrets, question content or recovery proofs. |
| `POST /room-invitations/{code}/memberships` | Join with name/team and recoverable operation proof. Reserve/check the last seat under the room lock; a lost response must not consume a second seat. |
| `PATCH /rooms/{roomId}/memberships/me` | Viewer changes its own pre-start name/team, subject to Ready/roster rules. Does not attach an account mid-game or change frozen game identity. |
| `PUT /rooms/{roomId}/memberships/me/readiness` | Confirm/withdraw Ready for the current Ready generation. Independent members' confirmations should not stale-reject each other merely because the general room revision changed. |
| `POST /rooms/{roomId}/memberships/me/account-binding` | Lobby-only NULL→account binding with both existing anonymous proof and already verified account principal. No login endpoint or retrospective progress credit. |
| `POST /rooms/{roomId}/memberships/me/departure` | Explicit participant departure; stop future credit/release the matching game claim atomically where applicable. Host departure ends active gameplay under the existing rule. |
| `POST /rooms/{roomId}/memberships/{membershipId}/removal` | Host removes a pre-start member, revokes its room access and preserves original historical rows. Known-account blocking remains enforced. |
| `POST /rooms/{roomId}/memberships/{membershipId}/unblock` | Host lifts a known-account removal block without reviving the removed membership or secret. |
| `POST /rooms/{roomId}/closure` | Host explicitly closes a room; active-game handling, old-result preservation and the one-open-room rule must be coherent. No silent abandonment of a paid active game. |
| `GET /rooms/{roomId}/control` | Owner-only generation metadata needed for explicit takeover; returns no secret and acquires no control. |
| `POST /rooms/{roomId}/control` | Same host explicitly acquires/replaces control; rotate the secret/generation and fence the previous controlling device. Lobby and current-game control must agree. |
| `POST /rooms/{roomId}/games` | Accept one fully validated game atomically, freeze roster/content and debit one existing token. No checkout/provider call. Repeated accepted Start returns that same game, including at admission cutoff. |
| `GET /games/{gameId}` | Current permitted host/viewer snapshot, game revision and authoritative clock information. Initial/reconnect/gap recovery uses the same projection rules as live push. |
| `POST /games/{gameId}/commands` | Strict discriminated gameplay commands listed below. One accepted command implementation owns authority, transaction/version checks, receipts and post-commit delivery. |
| `POST /games/{gameId}/media-access` | Authorize a bounded set of media references in this frozen game at the current phase. Return permitted URLs with explicit expiry; never accept arbitrary storage keys/URLs or issue audio to viewers. |
| `PUT /games/{gameId}/questions/{boardPosition}/{questionPosition}/feedback` | Original host sets Like/Dislike after reveal using an independent feedback revision. Terminal scores stay locked and content purge closes editing. |
| `GET /games/{gameId}/result` | Participant-authorized final score/winner/tie and category-award summary. Does not expose a public results-sharing feature or a general history browser. |

The command resource is a domain workflow boundary rather than generic table CRUD. Command names: `open_question`, `return_to_board`, `advance_hint`, `show_memory`, `hide_memory`, `pause_timer`, `resume_timer`, `reset_timer`, `reveal_answer`, `resolve_question`, `adjust_score`, `end_game`. Memory revisit uses `show_memory` after first hide without starting a fresh timer. Audio replay remains host-local, host-controlled and unlimited; transient visual status uses the realtime telemetry contract without quotas or PostgreSQL playback history.

## Mutation and retry contract

Every effectful call has a stable client-generated `Idempotency-Key` UUID, a server-computed canonical digest and its actual actor/resource scope. Host setup/gameplay changes additionally carry the relevant expected revision and current controller proof. Ready carries its member revision and Ready generation. Persist the semantic intent/secret/key before sending so refresh can retry exactly. Canonical digests exclude refreshed auth headers/trace IDs/response language, but include normalized semantic input and fingerprints of newly proposed credentials. Fields that establish caller identity or server time are never authoritative body values.

Process in this order:

1. Apply cheap input/abuse limits and verify the appropriate proof. Ordinary live host commands require the current fence. Source create/join/start recovery and already revoked departure use the narrower original-actor/outcome rules in the transaction appendix; they never grant live access or reinstall control.
2. Look for an already accepted operation within its exact scope before stale-version or new-admission rejection. Matching digest recovers its bounded original outcome; a conflicting digest returns an operation conflict. Join source lookup precedes current invitation resolution, and takeover recovery uses its saved installed proposal.
3. Apply new-admission checks/reservations only if this would create new load. A recovered room/seat/game/command is not new admission.
4. Acquire the documented locks, obtain fresh database time and recheck lifecycle, generation/revision, eligibility and any deadline. Validate the complete transition.
5. Commit all source effects, authoritative versions, bounded receipt and durable outbox hint together before acknowledging success. Never perform provider/socket/media I/O while holding those write locks.
6. Build/publish the current permitted view. A command receipt stores outcome IDs/versions, not historical private content, credentials or signed URLs. An acknowledgement's resulting revision and a later snapshot's revision may differ if more commands have committed.

Retry only bounded transient database/deadlock failures under the same operation identity. A stale expected revision prompts synchronization; never silently transform an old user intent into a different action. A duplicate does not renew inactivity, restart a timer, award points or debit again.

Room creation/join/rotation/control use the durable source/receipt design in [the transaction appendix](schema-and-transactions.md). Seven-day bounded non-score receipt cleanup never permits source duplication or stale-version reapplication. Media-access POST is fresh read/URL issuance: reauthorize every time and never replay an expired URL from a receipt.

One room is open per host. Its draft setup persists and has separate general/member revisions and a Ready epoch. Semantic selection/consent/roster/team changes invalidate everyone; cosmetic names, code rotation, takeover and presence preserve Ready. All current non-hosts must confirm the current epoch before Start; otherwise identify them and reject without silently excluding anyone.

Before a room exists, the verified host's own history supplies the fresh-first default; afterwards use the room's actual tracked roster. Pack lists sort by `(pack_number,id)`; the client picks the first filtered item unless the host explicitly chooses another. Empty fresh inventory offers another category or an explicit repeated pack, never a silent fallback. Initial Create stores provisional selections without repeat consent; confirm it through Setup against the actual room. Ordinary edits retain logical question history; replacements can make a historically completed pack Updated without granting the replacement progress automatically.

## Game start and authoritative transitions

Accepted Start creates exactly six board packs, 36 question snapshots/pins, the frozen roster, account claims, the game/controller identity, one game debit and post-commit work in one transaction. Validate complete ready content, actual roster freshness/repeat consent, existing account claims and token availability after locking. Unavailable/non-fresh stale selections return actionable alternatives without game/debit; never silently substitute. A resolved old game's claim cleanup runs separately before a fresh Start attempt.

Preserve question milestones: first opening/exposure is sticky; timeout never reveals/resolves; hint progress and reveal survive return/reopen. Open only unresolved copied slots from board; resolved tiles cannot reopen. Advance hints only for blur/zoom, exactly one stage up to 2. Memory's actual detail prompt remains absent until first hide; show/revisit and hide retain the accepted clock milestones. Reveal requires first hide for memory and stops current playback/clock.

All timer mutations require a current unresolved **unrevealed** question, and memory must already have first hidden. Reset immediately runs a fresh 60 seconds after the answering clock has started; it is forbidden after reveal. Navigation-paused time resumes on reopening; deliberate host pause remains paused. Host disconnect keeps the deadline running. Failed host media offers Retry/Pause, and viewer failures cannot mutate the game. Unresolved revealed reopening restores answer view without a new timer/attempt.

Resolve once after reveal to one team or nobody. A zero-point team award differs from no winner. Suggested stage points and actual question awards are distinct; awards never exceed the original tile cap. Manual total correction accepts 0–1,000,000 and records a delta without rewriting original awards; later legal awards may exceed that input ceiling. The 36th resolution or deliberate End locks scores and releases active claims. Unopened terminal restoration references the original debit once.

Winner is the team with the higher total; equal totals are a tie. Category wins use original question awards, and tied categories belong to neither team. Replay reuses the room, retains names/team choices, resets Ready and accepts a new game/debit only on the next successful Start.

## Projection and live delivery

Select native WebSockets through Nest's `WsAdapter`/`ws` as the lean initial implementation under API-Q3's engineering delegation. All business mutations stay REST. The server protocol only needs bounded authentication/subscription/reauthentication controls and versioned server state/recovery messages. This is a design choice, not measured evidence that one transport meets the capacity target.

- Enforce exact browser-origin policy, a bounded unauthenticated connection budget/deadline and authentication before subscription/content delivery. Do not treat asynchronous `handleConnection()` completion as a message gate. Browser-compatible credential exchange must avoid durable/logged credential URLs.
- Load current authoritative state and eligible recipients once per relevant version/audience where possible; build/validate/serialize shared safe data once, then deliver only to currently authorized recipients. A cached projection never proves current authority.
- Send complete current projections with separate room/game/projection revisions and stream sequence. Build from consistent reads, serialize/fence publication and discard late stale snapshots. Presence is a separate process epoch; terminal feedback/purge advances projection version while score/state version stays locked.
- Bound inbound frames, pending outbound bytes, subscriptions, retries and message rates. Coalesce superseded state; terminate persistently slow clients and let them recover a snapshot. Define ping/pong, reconnect jitter and short upgrade overlap without database heartbeat writes.
- Keep compression off initially, avoid per-second timer messages and let clients render from server deadlines/time offsets. Keep signed URLs/credentials out of durable events and generic caches.

| Game view | Permitted content |
| --- | --- |
| Lobby | Team setup, permitted member display/Ready state and selected category/pack summaries. No future question/answer/audio data. |
| Board | Six categories, tile point/status/winner summaries and team totals. No unopened prompts, answer fields or hidden media. |
| Open question | Current prompt/format, allowed image/hint stage, timer and visual state. Host alone can obtain question audio and operate controls. |
| Memory viewing/recall | Scene only while viewing is permitted; detail prompt/clock follows the accepted first-hide/revisit rules. A prior scene download cannot be made unseen again. |
| Revealed question | Its permitted answer/reveal image; resolution controls remain host-only. |
| Result | Frozen totals, game winner/tie and category wins; no post-finish score mutations. |

Mirroring means the common gameplay state, with responsive per-device rendering. It does not transmit host pixels, private host dialogs or audio. The initial public state after accepted Start is the board; optional intro/help/fullscreen/language presentation must not gate or change authoritative gameplay. Viewers follow current live focus rather than gaining independent question navigation.

## Cloudflare media

Use private immutable R2 keys pinned to the starting game. Authorize format/role/stage/reveal/memory visibility before issuing short-lived URLs with `expiresAt`. Omit original keys and unnecessary media references from client payloads. Viewer audio/forward-source access is forbidden even if a client manually calls the media endpoint.

R2 signing uses the AWS SDK's S3 client/presigner locally; bytes go directly from clients to Cloudflare. Initial engineering TTL is 300 seconds, proactively renew 60 seconds early, with at most two bounded refresh retries. Support browser CORS and Range GET audio; a GET signature does not automatically authorize HEAD, so return inspected metadata. An expired URL can appear as a generic browser CORS/network failure; do not depend on reading provider XML. Reauthorize and preserve progress. These budgets are tunable staging defaults, not performance results.

Only current hint variants are exposed. Person/color use generated cropped/grayscale question renditions; originals and `colorHex` appear only in revealed output. Forward reverse-audio playback requires copied reveal configuration and current host authority. Memory scene hiding removes new access while accepting that a previously viewed/downloaded image cannot be recalled.

## Errors, admission and observability

Use RFC 9457 Problem Details with stable application `code`, safe field issues and a request ID. Do not leak stacks, SQL, credentials, storage secrets or other players' private history. Use 400 for invalid input, 401 for missing/expired proof, 403 for forbidden operations, 404 for absent/inaccessible resources, 409 for revision/operation/lifecycle conflicts, 429 for caller abuse and 503 SERVER_AT_CAPACITY plus Retry-After for new-admission refusal.

Apply [the accepted admission policy](admission-control.md) to actual new room/game/seat allocation. Preserve bounded current-game work, accepted-operation recovery, authorized reconnect and permitted media renewal. Missing required fresh pressure samples pause new admission after grace. Reopen after fresh healthy measurements under a lower recovery threshold. Catalog caching and the availability preview never guarantee a later admission.

Measure command processing separately from visible push propagation and media transfer. Instrument pool wait/lock time, event-loop delay, memory, resource pressure, projection builds/cache, socket buffers and expected capacity refusals. Keep logs/traces redacted. No measured 100-room result exists yet.

## Schema and transaction appendix

The existing snapshots/actions/claims/ledger/outbox are retained. The [schema plan](schema-and-transactions.md) adds two tables for draft selections/room receipts, root/member/projection/feedback revisions, room control/source metadata, the open-owner invariant and lobby deadline support. It specifies the focused frozen-history guards/grants still missing from the foundation. None has been applied during planning.

Keep ordinary game commands game-first and never later update a membership, because its trigger acquires the room lock. Cross-resource operations such as explicit Leave and control takeover use room-before-game ordering; lock affected accounts/catalog records consistently and audit the complete trigger/FK acquisition graph. Finalize stale old-game state separately before new-start allocation. Exact reviewed DDL and executable SQL tests belong to implementation under this completed design.

The lobby-only source vector contains its room revision. Board/question/answer/result vectors require the game ID, state revision and projection revision together; structural schemas reject a partial game vector. Connection indicators come from separate epoch-scoped presence messages and cannot be rolled back by a cached HTTP/state view.

Protected HTTP responses and credentials/signed links use `Cache-Control: private, no-store`. Public catalog responses may cache for 60 seconds; keyset cursors bind locale/filter/order and use `(display_order,id)` for categories and `(pack_number,id)` within a category. Default page size 20, maximum 50; no query-per-pack/account pattern. Conditional room-context catalog requests require current host proof. Rate/size limits apply before expensive work; initialize gameplay JSON-body limit 16 KiB without altering AdminJS's middleware/parser order. CORS explicitly allows required bearer/control/idempotency headers and exposes request ID/Retry-After/replay metadata.

## Required validation

Prove duplicate/lost-response create/join/start/control/award behavior; last seat/token/admission reservation races; setup/Ready/join/Start interleavings; stale controller fencing; open versus end/expiry; leave versus exposure/completion; no unauthorized question/audio/answer leakage; media renewal after phase changes; snapshot recovery, slow consumers and restart occupancy; and no partial game/debit on failed Start/COMMIT. Preserve existing database/AdminJS HTTP tests. Run the agreed staged load profile in staging before claiming capacity.

## Primary-source checks

- Native schema facilities were verified in the installed `@nestjs/common` 12.3.3 validation/serializer declarations and implementation. Nest documents [Standard Schema validation](https://docs.nestjs.com/application/validation), [response serialization](https://docs.nestjs.com/application/serialization) and [OpenAPI integration](https://docs.nestjs.com/openapi/introduction#standard-schema-zod-valibot). Pin compatible dependencies during implementation rather than assuming an unverified bridge supports Nest 12.
- Nest describes [WebSocket adapters](https://docs.nestjs.com/websockets/adapter). The [ws maintainer documentation](https://github.com/websockets/ws) covers heartbeat/compression; its [API reference](https://github.com/websockets/ws/blob/master/doc/ws.md) covers payload limits and queued output. Application recovery and authorization remain required.
- Cloudflare documents [R2 signing](https://developers.cloudflare.com/r2/api/s3/presigned-urls/), [S3/Range support](https://developers.cloudflare.com/r2/api/s3/api/) and [CORS/expired URL behavior](https://developers.cloudflare.com/r2/buckets/cors/). [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457.html) defines the error envelope.
