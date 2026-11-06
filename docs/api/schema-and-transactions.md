# Gameplay schema and transaction plan

Design baseline 2026-11-06; API-Q1–Q19 are accepted. This specifies the next migration/services; it does not change the implemented 39-table foundation. See [the contract](gameplay-contract.md), [OpenAPI](openapi.json) and [acceptance plan](acceptance-and-handoff.md).

## Additive schema changes

| Record | Planned addition and invariant |
| --- | --- |
| `rooms` | `state_version bigint >=0`; `presentation_mode` (`lobby`/`game`); immutable unique `create_request_id` and 32-byte digest; current controller generation/hash/acquired time; meaningful lobby activity and checkpointed idle deadline. Partial unique `owner_account_id WHERE closed_at IS NULL` enforces one open room. Existing `lobby_generation` remains the Ready epoch. |
| `room_memberships` | `state_version bigint >=0`; immutable unique `join_request_id` and digest for non-host joins. Preserve the hashed anonymous proof through live revocation so its original join/result can still be identified. New name/team/Ready changes advance the member revision. The host membership is established by Create, without a separate join identity. |
| New `room_pack_selections` | PK `(room_id, board_position)`, positions 1–6, unique category per room, category/pack FKs, observed content revision, optional repeat-consent basis/time/host. Drafts have 0–6 rows; accepted Start requires exactly six valid rows. Store typed identities, never question copies or expiring URLs. |
| New `room_actions` | Globally discoverable operation UUID, room FK, typed actor account/membership/proof references, operation name/digest, relevant expected/result revisions/generation, accepted time and bounded outcome IDs. Append-only accepted receipts; no credentials/content/URLs. Explicit narrow cleanup permission. |
| `games` | Independent monotonic `projection_version bigint >=0`, advanced for every visible game change including feedback and purge. Preserve the terminal score/state-version lock; the projection counter lets late output/cache work recognize newer terminal content. |
| `game_questions` | `feedback_version bigint >=0` for independent host Like/Dislike concurrency, including after score lock. Existing copied content and runtime fields remain. |

The planned physical model adds two tables (39 → 41), not a second gameplay store. Define all CHECKs/FKs/indexes and preserve the existing migration contract in reviewed Drizzle plus SQL. No migration, install or production DDL is performed during planning.

Room/member revisions advance only on actual accepted changes. Ready toggles advance the member and room revision but never the Ready epoch. A meaningful category/pack/consent, roster or team-assignment change advances the Ready epoch once; old confirmations then become ineffective without updating every member row. Cosmetic names, invitation rotation, refresh/presence and same-host takeover preserve Ready. A no-op changes no activity/revision, but can have a receipt.

Start sets presentation mode to `game`. While that game is active its pointer determines board/question focus; after termination the same mode renders its result. Explicit host `POST /rooms/{id}/lobby` sets `lobby` while preserving the terminal game/current pointer/history. It works even when the next selections are identical. Ready/setup mutations require lobby focus; this makes replay synchronization and refresh deterministic without reopening a game. Start already advanced the next Ready epoch.

For an anonymous member who authenticates through an external flow, `POST /rooms/{id}/memberships/me/account-binding` requires both its existing anonymous proof and the already verified account principal, expected member revision and Ready epoch. Permit NULL→matching account only in lobby; enforce uniqueness/known-removal rules, invalidate Ready/consent and preserve every previous anonymous game snapshot. Revoke the old anonymous proof for all live access and close its stream; new live access requires the bound verified account. Retain the old hash only for compact results whose frozen player was anonymous. Active-game binding is rejected; no login or retrospective progress grant is added.

Full selection replacement must allow swapping categories between positions: delete/reinsert the bounded draft rows under the room lock, with a narrow DELETE grant, or use a correctly deferred uniqueness strategy. Do not use a naive per-position UPSERT that conflicts with another current position.

Repeat consent binds the actual pack/revision/current question identities and actual roster/team identities. It excludes cosmetic labels, general room revision and Ready flags, so later independent Ready confirmations do not invalidate it. The server computes a deterministic basis; clients return that exact basis with explicit consent. Roster/team or selected-content changes clear invalid consent. Catalog revision changes are rechecked at Start and return actionable reconfirmation rather than transferring old consent.

## Credentials and lost-response recovery

Host Create/Takeover and anonymous Join pre-generate and persist a canonical base64url 32-byte CSPRNG secret plus operation UUID before sending. Secrets travel only over HTTPS/WSS, are redacted from logs and never appear in generic receipt bodies. Server hashes use explicit purpose/version and canonical resource UUID framing. A client cannot supply its own stored hash as the credential.

One controller base secret belongs to the controlling device of a room. Store `SHA256(domain(room-control, roomId) || secret)` on the room. At Start, verify that proof and derive `SHA256(domain(game-control, gameId) || secret)` for the new game, initializing game generation to the room generation. Set the game acquisition time to the fresh Start time, satisfying its existing `>= started_at` CHECK. Start issues no new plaintext secret.

An active takeover locks room then game and rotates both purpose-bound hashes/generations atomically from the new pre-saved proposal. After accepted-duplicate recovery, reject a new takeover that reuses the currently installed secret/hash; a fresh generation alone must not revive the old device's proof. After termination, rotate only the room: the historical game's controller fields are frozen. A new tab with only account authentication cannot replace the controlling stream or obtain audio.

| Operation | Durable source and recovery |
| --- | --- |
| Create room | Find its immutable create UUID/digest using the verified owner before allocating. Return the original room even if it later closed or another room now exists; never silently apply a new setup. A stale original secret does not regain control. |
| Anonymous Join | Find immutable join UUID globally and verify the saved proof/digest **before resolving the current invitation**. Recover its original membership if code rotated/expired or was reassigned to another room. Never allocate a second seat in the new code owner. |
| Signed-in Join | Same source identity; verify the matching account. No body account ID is identity proof. |
| Start | Existing unique `games.start_request_id/digest` recovers the original game before another freshness/balance/admission attempt. No second debit. |
| Takeover | Verify owner and matching accepted proposal/current hash, then recover the receipt before rejecting its old predecessor generation. If a later takeover replaced that proposal, return `CONTROLLER_FENCED`; never reinstall it. |
| Ordinary accepted mutation | Verify appropriate current authority, recover its receipt before stale-version rejection, and return only the original bounded outcome. Same key/different digest conflicts. |
| Departure/closed membership | A matching retained proof may recover its identical bounded prior outcome, never re-enroll or recover live access. Returning a revoked outcome is distinct from issuing a new grant. |

Canonical request digests include the validated semantic payload, expected resource/member/feedback versions and explicit takeover predecessor generation, plus fingerprints of newly proposed credentials. Exclude bearer tokens, current authentication headers, trace IDs and response language; token refresh/current authorized proof must not change an operation's identity. Store the actual accepting controller generation separately for audit. A current controller may recover an earlier bounded outcome under the same host account; a fenced proof cannot pass the authority check.

Keep accepted non-score receipts for at least seven elapsed days; cleanup is bounded. Accepted create/join/start identities/digests remain on their source rows independently. Score-bearing action history stays protected under existing retained-result policy. Other old intents cannot be applied again after receipt cleanup because expected root/member/feedback revision and Ready epoch must still match; after an applied state change they are stale. No-op replay must remain a no-op. Return `409` synchronization/expired-outcome information when a non-source receipt is no longer recoverable; do not promise infinite response replay.

## Live versus historical authority

Host operations require an active verified original account; live host operations also require its current controller proof. Account verification is an injected existing boundary, not a new login endpoint.

Anonymous proof identifies its room membership. Live room/game/media/subscription requires unrevoked anonymous membership with no bound account and permitted participation. A retained proof may identify an original **anonymous** frozen game participant for compact terminal result reads only, even after departure/removal/room closure/account binding. It gives no question/media/live access, no access to later signed-in games and cannot create a new seat. Keep this historical identity hash with the retained game linkage; authorized privacy redaction may later remove it. Signed-in historical access uses the matching original account. An invitation/game UUID alone gives neither kind of access.

Host question feedback uses the verified original host account, a revealed retained question and expected feedback revision; it does not unlock score changes. After purge, return `410 CONTENT_PURGED`. Store its bounded receipt through existing non-score `game_actions`: expected/result game state version both equal the root state version observed under lock, while requested/result feedback revisions are in the digest/outcome. Increment only feedback/projection revisions, not terminal score/state version. Purge increments the projection counter too. Projection reads use one consistent database snapshot (single SQL, short read-only repeatable-read or version-checked bounded read), and publication fences stale asynchronous results against room/game/projection revision identity.

## Lock order and time

Never acquire room after game. The existing membership trigger locks room on **every membership INSERT/UPDATE**; include that implicit lock in the graph.

| Path | Order / boundary |
| --- | --- |
| Lobby/setup/Ready/join/remove | Room → affected draft/membership rows. Required catalog validation and any account locks use the common stable ordering. |
| Start | Room → selected catalog locks in stable category/pack/question/media order → participating accounts sorted by UUID → new game, roster, snapshots, ledger, receipt/outbox. No old-game finalization inside this transaction. |
| Ordinary gameplay, feedback, end/expiry | Game → affected accounts in sorted UUID order. Never update room memberships. Feedback additionally locks its bounded question after the game. |
| Explicit member departure | Room → current game if any → affected account. Mark game departure and release only a matching claim in the same transaction; then update membership under the already held room lock. |
| Active takeover / explicit room close | Room → current game → sorted affected accounts where needed. Recheck status after locks; terminal game controller fields are immutable. |
| Expired old claim during preflight | Finalize in its own short old-game transaction, then retry new allocation from fresh state. |
| Room creation | Check/finalize an old open room separately before creating. Do not hold account locks while waiting to close an old room; the partial unique owner key is the final concurrent-create guard. |

Use fresh database time sampled **after** required row-lock acquisition. Resolve effective expiry before accepting a new state change; retries, heartbeats, GETs and socket presence never extend deadlines. COMMIT/deferred-constraint failure must roll back all effects and release the pool client/reservation before retry/error. External I/O stays outside write locks.

Ready requests carry expected **member** revision plus Ready epoch, allowing different members to become Ready concurrently without conflicting over the general room revision. A delayed Ready must not overwrite a later withdrawal: stale member revision rejects it, and a repeated operation returns its original receipt. Start holds the room lock while checking all current members and freezing one roster.

## Idle deadlines and meaningful actions

Game renewal applies only to actual accepted open/back/hint/memory/timer/reveal/resolve/score changes while still active. Start initializes it. No-op commands, feedback, audio playback/telemetry, media renewal, account/control recovery and reads/presence do not renew it. End does not extend a deadline; delayed expiry records the existing `idle_expires_at` as effective `ended_at`.

Lobby renewal applies to actual accepted setup, participant name/team, Join/Leave/removal, account binding, Ready/withdrawal, opening replay lobby and invitation rotation changes. Create initializes it. Reads/presence/control acquisition/no-ops do not renew it. Its effective idle base is `max(last_meaningful_lobby_activity_at, current_terminal_game.ended_at)`; deadline is that instant +24 elapsed hours. Ignore/suspend lobby expiry while the current game is active.

Game-only finalization writes a room-refresh outbox hint rather than updating room under the game lock. A later room-only worker checkpoints the derived deadline, fenced by the current-game pointer. It never uses worker execution time as a new window; stale jobs cannot close/renew a replay room. Authoritative room requests derive/recheck the deadline even if checkpoint work is delayed.

Closing a room without an active game revokes its invitation/live memberships and releases its open-owner slot. Explicit host closure first checks fresh effective expiry under the game lock: an overdue game finalizes as `idle_timeout`, preserving that reason. An otherwise active game ends as `host_left`, runs terminal cleanup/restoration if eligible and closes room atomically in room→game order. Host `end_game` alone keeps the reusable room. Host departure uses the explicit close transition with expected room revision; compact result access survives through original participant proof.

## Strengthen frozen-history guards and grants

The current foundation does not yet guard every gameplay-history mutation. The implementation migration must:

- Freeze terminal game controller fields as well as its existing score/version/lifecycle fields.
- Make `game_packs` starting source/revision/category/position immutable, allowing only approved privacy redaction if applicable.
- Freeze `game_players` identity/team/seat; allow only one-way explicit departure and narrow account-deletion display redaction.
- Protect score-bearing `game_actions` from UPDATE/DELETE; allow bounded expired non-score receipt cleanup only.
- Make retained media pins immutable; DELETE only during the due terminal purge under its root game lock. Preserve catalog/other-game references and existing purge guards.
- Make room/create/join source identities and accepted receipts immutable; enforce general/member/Ready revisions and sticky closure/departure/controller changes through focused service/guard paths.
- Replace broad receipt/history UPDATE/DELETE permissions with explicit grants. Add only the new mutable draft-selection DELETE permission; never relax ledger/private-function protections.

Any permitted privacy redaction of visible historical names/content increments the appropriate projection revision and invalidates affected caches. Account deletion/deactivation rules must also be respected by historical-proof authorization; retaining a hash is not a bypass of explicit identity/privacy cleanup.

Test the migrated restricted runtime role, not just owner-role SQL. Preserve all existing database checks/financial behavior; any guard replacement must keep its other invariants. These changes are specified here, not applied.
