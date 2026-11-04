# Sahsah query, integrity and index plan

Updated 2026-11-03, v1.2: named access paths align with DBML and companion partial indexes. Selected queries now have disposable PostgreSQL EXPLAIN/footprint measurements; API and deployed throughput remain untested. See [quality review](design-quality-review.md).

## Accepted shape and relationships

- A room has multiple distinct games; replay does not overwrite a previous game.
- A category has many authored question packs; each pack contains exactly six fixed questions.
- Q5/Q6 accepted: a game selects one pack from each of six categories, and game tokens include access to every published pack.
- Q8/Q16/Q18/Q20 accepted: complete all six in one game, including no-winner resolutions; credit signed-in starting players despite network loss, but stop future credit after explicit departure.
- Q9 accepted: each question record belongs to one manually authored pack; semantic duplicates across records are not automatically detected.
- Q7/Q10/Q11 accepted: group-aware freshness uses question opening history, the roster freezes at start, and repeats require host acceptance when fresh packs are unavailable.
- Q12–Q14/Q17 accepted: public edits are permitted after warning/confirmation; games preserve starting snapshots; replacements create new identities and flag Updated without erasing historical completion.
- Q15/Q19 accepted: one active game per signed-in account; signing in during a guest game begins progress next game.
- Q21–Q28 accepted: host end/leave is final, 24-hour gameplay inactivity expires a game, same-host device takeover fences the old controller, host funds one token, unopened terminal games restore once, and verified unrecoverable failures permit controlled restoration. Paid/gift credits do not expire.
- Q29–Q40 accepted: quantity 1–20, base100EGP, shared quantity tiers, one winning extra discount, verified-phone gift binding, separate staff identities (latest Q89: operational Admin plus Super Admin staff management) and reasoned complimentary grants.
- Q41/Q42/Q46/Q46a/Q47 accepted: zero-cost settlement skips Paymob, promo allowance is held until accepted settlement or confirmed closed-unpaid release, codes target exact fixed bundles with end dates, and all granted tokens are nonexpiring.
- Latest bank scope excludes ordinary customer cash-out/refunds, source-lot allocation and refund-reserved balances. Keep provider reversals for exceptional reconciliation rather than infer a new customer feature.
- Q49–Q55 accepted: automatic 60-second answering clocks, unlimited audio, manual memory viewing with first-hide timing, paused/preserved reopening, original-tile award caps and audited nonnegative total corrections. Q56–Q60 lock terminal scores, preserve category awards and finish automatically on the 36th resolution.
- Q61–Q83 settle ten formats/media, invitations/readiness, Egypt identity/phone changes, deletion consent, free campaigns, verified late/extra payments, feedback/contact, no CSV and 12-month copied content. Q84–Q87 are accepted: room blocks/unblocks, closed post-purge feedback, fresh deletion funding consent and campaign-local phone allowance.

These distinctions matter before field/index choices. In particular, the old unique published `(category, row)` rule would prevent the many packs the user now requires.

## Candidate access paths

| Named operation | Query shape / expected result | Candidate access path | Dependency |
| --- | --- | --- | --- |
| List playable categories | Small ordered public catalog | Start with the table's primary key and measure before adding a low-selectivity status index | Publishing and ordering rules |
| List a category's packs | Category filter, stable human pack order, paginated if needed | Unique packs `(category_id, pack_number)` also serves ordered listing | Publication/archival filters; allocate number under category lock |
| Add progress to the pack list | One category page joined to the selected account's historical completions and current question identities | Account-leading completion key and indexed current/game slots; optional later rebuildable `(account_id, pack_id)` summary | Actual projection/query and retention volume |
| Find a pack unseen by a group | Category filter; exclude any pack with a current question exposed to a tracked starting account | Exposure primary key `(account_id, question_id)` plus current slots `(pack_id, slot_number)`; set anti-join over at most six accounts | Atomic start/claims, public status and valid pack inventory |
| Fetch a pack's six questions | Current pack identity, slot order, six records | `questions` current pack/slot partial unique index; filter `retired_at IS NULL` | Media/mode payloads and publication validity |
| Fetch a game's frozen board | One game, six categories and 36 copied questions | `game_questions` primary key `(game_id, board_position, question_position)` | Authorized projections; media/mode payload validation |
| Resolve invitation code | Exact active code, one room | Unique nullable `rooms.invitation_code`; expire/clear the old owner in a separate transaction before reuse | Code lifetime and reuse |
| List games in a room | One room, deterministic creation/sequence order | Unique games `(room_id, sequence_number)` | Sequence semantics and retention |
| List account history | One owner, newest first, bounded page | `game_players(account_id, joined_at, game_id)` joined to games | Account ownership and history/status filters |
| List a participant's games | One signed-in account, joined to saved games | `game_players(account_id, joined_at, game_id)` | Final pagination/date/status query |
| Claim one active game | One signed-in account, exact claim and matching membership | `accounts` PK and `active_game_id`; composite roster membership FK | Paid start and lifecycle transaction boundaries |
| Release all claims for an ended game | One game, its remaining signed-in players | `accounts(active_game_id, id)` | Atomic terminal cleanup and retry semantics |
| Explicitly leave | One game/seat; mark left and release matching account claim together | Player primary key plus account-claim primary key | Host/guest authorization and serialized game transitions |
| Resolve question / correct score | One game, one slot/team, authoritative transaction | Unique resolution per game slot; membership keys; lock/version the game | Scoring and undo policy |
| Resume or navigate question state | One root game, current pointer and at most 36 runtime rows | `games` PK/current pointer; `game_questions` composite PK | Current controller authorization, deadline calculation and allowed transitions |
| Render scoreboard | Two teams in one game | `games` PK with two explicit team score/name groups | Projection updated with score entries in the same transaction |
| Read score history / category awards | One game, ordered entries or bounded slot resolutions | `game_actions` game/result-version history, partial score/version uniqueness; question PK/resolution fields | Overall correction versus category attribution and final result lock |
| Accept a repeated command | One actor/scope and operation identity | Unique operation key at its actual scope | Controller identity, command retention and retries |
| Consume access at game start | One wallet owner, one game | Unique debit source per game plus a short wallet/game transaction | Economy and cancellation policy |
| List account orders/movements | One account, deterministic date/ID cursor | Account/date/ID composite indexes on retained financial records | Provider-state projection and retention |
| Find overdue active games | Active status, deadline bound, bounded deterministic batches | `games(status, idle_expires_at, id)` | Fresh-clock post-lock checks, retry/fairness and measured batch size |
| Change controller / verify host command | One game, authenticated same-host account, generation and credential hash | `games` PK/controller fields; host/room owner FK and frozen-roster start validation | Session issuance, serialized game state/version and actor authorization |
| Read token balance | One account | `accounts` primary key and token_balance | Ledger/balance transaction and reconciliation |
| List token movements | One account, newest-first bounded cursor | `token_ledger_entries(account_id, created_at, id)` | Final ledger retention and purchase-source linkage |
| Charge/restore a game once | One host/game, kind and original typed debit | Unique `(game_id, entry_kind)` plus typed-source membership key/FK | Eligibility under game/wallet locks; staff audit for platform failure |
| Price a selected quantity | Singleton settings plus active highest eligible threshold | `shop_settings` singleton PK and a bounded validated tier array | Consistent quote/config lock and immutable order values |
| Resolve entered promo | Exact normalized code, dates and quantity eligibility | Unique code | Final normalization policy, cap checks/holds and current time |
| Enforce promo caps | One promotion/global or promotion/buyer/state count | `promo_usages(promotion_id, state)` and `(promotion_id, buyer_account_id, state)` | Serialize admission; count held/consumed; release only after confirmed unpaid closure |
| List buyer orders | Buyer filter with newest-first deterministic cursor | `token_orders(buyer_account_id, created_at, id)` | Paid/zero acceptance and exceptional provider states |
| Find gift claims | Verified phone and unmatched bound-account state | `token_orders(recipient_phone_e164, id)` | Ownership verification, stable account binding, payment evidence |
| Issue order/staff credit | One source order or staff event, beneficiary, exact quantity | Unique ledger source order/staff action; composite settled order/beneficiary/quantity/kind source | Verified positive payment, valid zero-cost acceptance or authorized Admin action |
| Resolve code's fixed target | One promotion and its exact bundle quantity | Promotion primary/code key, fixed quantity CHECK and `shop_settings` active bundle configuration | Active/end-date/admission checks; either selector qualifies at exact quantity |
| Review staff action | Actor or generic resource, ordered history | Actor/date/ID and target-kind/ID/date/ID audit indexes | Authorized staff view, sanitized metadata and retention |

All index definitions must be checked against the eventual SQL, including prepared query predicates. Reuse the indexes already created by primary/unique constraints. A foreign key does not create a child-side index automatically; evaluate the query and deletion paths before adding one. See [PostgreSQL constraints](https://www.postgresql.org/docs/18/ddl-constraints.html) and [multicolumn indexes](https://www.postgresql.org/docs/18/indexes-multicolumn.html).

## Integrity stronger than an appealing diagram

For the accepted pack structure:

- A slot bound of 1–6 plus unique `(pack, slot)` establishes **at most** six slots. It does not establish that a published pack has **exactly** six. Publication must verify completeness and the point distribution transactionally under the selected authoring model.
- Game-category and game-position uniqueness prevent duplicates but do not alone establish a complete six-category board. Validate all 36 slots before accepting the paid game start.
- A chosen pack must belong to the category at game start; validate while locking the current catalog and preserve the pairing as historical game data. Do not permanently tie that snapshot to the catalog's mutable current category assignment. Composite references still enforce in-game pack/player/team membership where the referenced relationship is stable.
- Cross-row completion, token availability and once-only side effects need transaction rules in addition to row-level checks.
- Current pack slots can change after public-edit confirmation; retained question IDs preserve history and each game keeps starting copies. The authoring-slot composite FK verifies current question ownership, but a retired question must also be excluded by required save/start validation.
- The single active-game pointer on an account enforces at most one claim, while its composite membership FK binds that claim to the signed-in roster entry. Lifecycle write paths must release claims when required; a network disconnect does not do so.
- The durable first-opening timestamp is never reset. Ending/expiry with no opening restores the original host debit once; after opening, ordinary ending/inactivity does not. Opening versus ending/expiry must serialize on the same game row to resolve races.
- The ledger's typed source FK binds a restoration to a same-host/same-game debit, while unique game/kind permits at most one restoration. Balance equality with the cross-row ledger sum and unopened/staff eligibility require transactional write paths, not row checks.
- Controller generation and credential replacement fence old-device mutations only if every host command rechecks authority under the game lock. Neither a client device ID nor a socket's old login result is sufficient authority.
- Positive credits directly contain a unique order or staff authorization. The order/account/quantity/settlement-kind FK prevents an unbound or pending order from crediting another account. Companion proof/source/atomicity guards and the ledger-owned bank projection complement adapter verification and service authorization.
- Gift-only order membership and buyer/beneficiary checks prevent structural self-order mismatches, while canonical verified-phone self-gifting needs the identity transaction. Staff audit FK proves actor reference, not role or action correctness.
- Price/discount checks preserve exact numeric rounding, quantity limits and one extra discount. They do not prove server quote authority or winner eligibility. Zero-cost acceptance has a separate marker/state and no gateway attempt; paid markers require a positive total. Consume zero-cost code allowance and credit atomically.
- Released promo usage requires a null consumption timestamp. Never release consumed use because a game was unused or a token restored; old/new state guards are needed as well as row checks. Unknown provider outcomes retain their hold for reconciliation.
- Gameplay state/score keys bind rows to the same game, while current controller authority, exact snapshot point caps, one running current question, append-only history and score-projection equality require a serialized command transaction. Read remaining time from a deadline; do not update timer rows per second.

PostgreSQL `CHECK` constraints do not validate arbitrary other rows. These boundaries combine relational constraints, focused PostgreSQL guards and required future service transactions. The [local SQL suite](validation/README.md) tests selected guarantees; it does not implement the full game engine. [PostgreSQL constraint semantics](https://www.postgresql.org/docs/18/ddl-constraints.html).

## Progress read/write strategy to evaluate

An account's category/pack list can join historical completions and current six-slot identities in one set query. Avoid creating an “unplayed” row for every account/pack combination merely to render the list. Group availability is a separate query across the fixed participating accounts; it must not overwrite an individual's progress.

Completion is a historical account/game/board-position record, credited only after six valid resolutions in that game. Preserve it after pack replacement and flag current content Updated. Compare deriving the display from those records with maintaining a transactionally updated, rebuildable account/pack summary once actual read volume justifies it. Cross-game partial resolutions must not be combined. An explicit departure stops future exposure/credit; prior records remain intact.

The initial catalog has approximately 4,000 questions, not an established history volume. Future growth is driven by games, memberships, command records, financial movements and retained progress/exposure. The account/question summary grows once per distinct account/question pair rather than once per re-view; detailed per-game events have a different retention purpose. Stable key types and exact indexes remain technical proposals until the query/DDL review. Start with ordinary indexed tables; partitioning and a new cache service require evidence from growth/retention and measurements.

## Launch resource implications

Use [the Railway research](railway-capacity.md) to distinguish peak connected clients, rate of state-changing commands and monthly occupied room-hours. A budget tier cannot supply a maximum room count.

For the single API/database topology, evaluate a small bounded application connection pool, authoritative state persisted at meaningful transitions, client-rendered countdowns, initial state snapshots and compact change messages. Neither an open WebSocket nor a timer tick should require a dedicated PostgreSQL connection or a write each second. Media bytes should travel through Cloudflare; PostgreSQL holds content metadata and references.

Expiry updates are tied to accepted gameplay commands, not heartbeats. Use 24 elapsed hours and a fresh database clock after lock acquisition. A background sweep selects due rows with a bound cutoff and rechecks locked rows; authoritative requests enforce the deadline even if the sweep is delayed. Finalize stale old-game claims in a separate transaction before retrying a new start. See [lifecycle transactions](lifecycle-transactions.md) and [token accounting](token-accounting.md).

The v1.2 supplement uses active-only deadline and unpurged-content partial indexes instead of full-history maintenance indexes. Worker queries explicitly imply those predicates; do not add both alternatives in production. No clock-dependent index predicate is proposed. Every supporting unique index in the ledger/controller has a specific FK or once-only purpose, including the otherwise redundant typed-source key.

The commerce draft uses one token purchase per order, so there is no order-item/basket join in its source-grant path. Presets are UI quantity shortcuts and fixed promo targets, not SKU multipliers. Price tiers, promotions and staff roles are small reference sets; avoid additional caches or JSON indexes without measured need. Provider attempt/transaction/proof/inbox/settlement and reconciliation records are now modeled. Do not add ordinary refund holds or source-lot spend allocation: each game updates one combined wallet and its ledger.

The gameplay draft uses game-leading keys: load the game's two team field groups/current pointer and at most 36 combined question rows. Score history uses game/result-version ordering with partial score-effect uniqueness. No timer-deadline/status index is needed for client countdowns, and no JSONB index is proposed for copied content loaded by slot identity. See [gameplay transactions](gameplay-design.md).

## Verification required before final indexes

1. Translate the accepted product rules and named operations into the implemented API SQL; preserve the recorded schema/guard contracts.
2. Seed representative categories/packs, publishing states, histories, progress skew and the agreed question/media distribution.
3. Inspect plans with `EXPLAIN (ANALYZE, BUFFERS)` on disposable representative data; compare row estimates, scanned rows, sort work, reads and latency.
4. Exercise simultaneous starts, duplicate awards, pack reservation/selection, content publishing and payment callbacks to verify integrity under concurrency.
5. Run the proposed 10/25/50/100-room stages against the implemented deployment; record pool waits, CPU, memory, event-loop delay, p95/p99 acknowledgment, fanout, egress and correctness.

Product rules are settled. Selected SQL concurrency cases and synthetic plans are now recorded in [validation](validation/README.md); full API traffic, progress skew, media distribution and deployed load stages remain future validation. `EXPLAIN ANALYZE` executes its statement; testing mutations requires disposable data or carefully isolated transactions. [PostgreSQL EXPLAIN](https://www.postgresql.org/docs/18/using-explain.html).

## Native access paths added in v1.1

| Operation | Access path / authority |
| --- | --- |
| Resolve native SKU | Unique `store_products(provider, application_id, provider_product_id)`; six launch mappings. |
| Deduplicate Apple purchase | Unique provider/environment/app/Apple transaction identity. |
| Deduplicate Google purchase | Unique `store_purchases.purchase_token_hash`; optional order reference is not a key. |
| Recover native buyer history | `store_purchases(buyer_account_id, created_at, id)` and normal order history. |
| Accept native credit | Common unique ledger order source plus order/purchase/SKU/channel/buyer/quantity/proof references, under account/order/purchase locks. |
| Process native delivery/proof | Actual native notification identity or exact fingerprint; processed typed observations with purchase/verified-time history. Canonical facts may recur later and are not globally unique; order/ledger keys deduplicate fulfillment. |
| Retry completion | Existing leased outbox; no credit is repeated. |

`provider_namespace` is the real Paymob merchant or Apple/Google app identity. Native order quote fields do not copy website price arithmetic; observed native money belongs to verified purchase evidence. [Native protocol](native-store-billing.md) defines the write-path checks beyond these FKs.

## Measured v1.2 index refinements

Nineteen partial indexes accompany the DBML. Maintenance predicates cover active claims, signed-in recovery, active expiry, unpurged content, active invitation codes, pending/running jobs, non-score receipt cleanup, unredacted phone lookup, queued/review payment events and mapped attempt/native history; a campaign-local phone lookup supports allowance counts. Existing current-slot, active-room, current-membership, open-deletion and score-effect uniqueness remain. No JSONB GIN, partitioning, replica or separate cache is added.

The current-slot unique index serves six current questions; remove the extra `questions_pack_current_list`. Two order source UNIQUE constraints are redundant with exact source FKs and are removed, while all referenced backing keys remain. Global inquiry/native facts-hash uniqueness was incorrect for recurring financial states and is removed. Native receipt history and campaign phone lookup are added for actual new predicates. Total index structures fall from 150 to 148, counting all primary/unique keys; footprint matters more than that count.

[Recorded plans](validation/latest-results.json) compare 100,000 jobs and 10,000 terminal games with small live subsets. Pending, lease and purge paths select sparse indexes; active expiry may instead use existing active-room uniqueness plus a small sort. Literal state predicates are intentional; generic prepared parameters may prevent partial-index implication. Keep statistics current and remeasure after real distribution changes. No local timing is a Railway capacity promise.
