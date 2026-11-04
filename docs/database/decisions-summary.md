# Sahsah database decisions

Updated 2026-11-03, v1.2. The user selected **retain every agreed feature with a simpler, approximately 37-table physical model**. The [current DBML](sahsah.dbml) now contains 39 tables; [ADR 0007](../adr/0007-consolidate-launch-schema.md) records the choice. This is a design artifact, tested in disposable PostgreSQL; it is not a migrated application database or implemented API.

For the next coding session, use the [complete implementation prompt](implementation-prompt.md), prepared 2026-11-04. It consolidates final rules and historical overrides and defines the schema/backend integration deliverable without treating the whole application as already implemented.

Q88 adds native Apple/Google billing. The latest Q90/Q91 correction selects fixed native 1/2/5 bundles and personal purchases; website quantities 1–20, gifts and promos remain. Q92 aims to match website EGP prices where permitted. Q93 separates store-offer limits from web-code limits; Q94 allows first verified unmatched purchase claim into the claimant’s own bank. Q89 replaces Content Admin with broad operational Admin; only staff management stays Super Admin. The native extension is now represented by two additional tables and shared channel-specific order/evidence constraints, giving 39 tables. It remains unimplemented at runtime. See [the scope review](payment-and-staff-scope-review.md), [ADR 0008](../adr/0008-regular-admin-operational-access.md) and [ADR 0009](../adr/0009-native-store-purchases.md).

## Architecture and simplification

| Decision | Result and reason |
| --- | --- |
| Keep the full agreed feature set | Public pages/branding, self-service phone changes and automatic free campaigns remain. The proposed launch deferrals were not selected. |
| Consolidate the physical schema | Reduce the original 61-table scope to 37, then add two records for the newly approved native purchase scope: 39 total. The [complete mapping](schema-simplification-review.md) accounts for every former table. |
| Keep PostgreSQL authoritative | Accepted games, scores, progress, active-account claims, token movements, promo allowances and payment evidence survive process/cache loss. |
| Use rebuildable caching | Recommend bounded in-process caching for one API instance, plus disposable socket/presence maps. Redis is a later option when a shared cache is justified; no cache service/package was installed. |
| Keep files in Cloudflare | PostgreSQL stores asset identities/metadata and relational references, not image/audio bytes. Original/answer media access is checked before delivery. |
| Use JSONB selectively | Bounded question-format settings, starting snapshots and small pricing arrays; identifiers, balances, money, state/version and queried relationships remain typed columns. |
| Keep staff simple | Three staff tables: accounts, sessions and audit. A fixed role field supports Super Admin and Admin. Focused actions manage sensitive operations. |
| Preserve database guards | Ledger inserts own the bank projection. Typed processed financial proof, accepted settlement/credit, immutable sources and accepted lifecycle boundaries have companion PostgreSQL guards. Services still validate authority, complete boards, quote eligibility and game commands. |
| Optimize actual queries | Short transactions, named indexes and deadline-based timers. Fewer tables do not establish a capacity or latency result. |

The principal consolidations are:

- `accounts` includes Firebase project/UID, its active-game pointer and token balance; the ledger remains separate.
- `questions` includes its pack slot; retired identities remain. `question_media` includes numbered hint variants and points.
- `rooms` includes its current code/window; `room_memberships` includes its reconnect hash. A dedicated code-issuance history is a former technical mechanism, not an added user feature.
- `games` includes the two fixed teams, score totals, current-question pointer and controller identity.
- `game_questions` includes separate snapshot, runtime, resolution and feedback fields in one row per question. `game_question_media` still pins retained assets relationally.
- `game_actions` combines accepted command receipts and optional score effects. This uses current state plus action history, not full event sourcing.
- `token_ledger_entries` includes the unique originating order/staff credit authorization; no separate grant table or source-based bank is required.
- `shop_settings` includes the small tier and fixed-bundle configurations; orders preserve accepted values.
- `token_orders` includes gift fields and its single accepted settlement. Verified payment evidence still has explicit records.
- `payment_events` combines verified callback intake and authenticated inquiries with typed proof/processing fields. Actual transactions and provider-reference mappings stay separate.
- Merchant credentials/configuration are deployment-managed; merchant/environment/config identity is frozen on financial records.
- Gift-phone corrections use structured staff audit actions. Staff roles are an enum on the staff account.

The trade-off is deliberate: fewer rows/entities and joins, with more cross-field/transition validation in focused NestJS services and AdminJS forms. A smaller table count is not a reason to hide mutable money or searchable progress inside arbitrary JSON.

## Product rules retained

| Area | Confirmed rules |
| --- | --- |
| Source authority | User decisions take priority; quotation provides scope and prototype provides gameplay evidence. Resolve conflicts explicitly. |
| Deployment | One NestJS API and one writable PostgreSQL instance initially. Independent frontend/backend/prototype projects remain intact. No read replica or extra cache/worker service is required by this model. |
| Room versus game | A room is reusable. Each accepted start/replay creates a new game and preserves previous results. |
| People and board | Maximum six people **including the host**. Two scoring teams, six categories, one six-question pack per category: 36 tiles with 200/200/400/400/600/600 points. |
| Catalog | Categories contain manually authored fixed packs. Each question belongs to one pack. All published packs are available through game tokens, with completed/remaining visibility. No per-user shuffled pack contents. |
| Content authoring | All ten formats; mixed-format packs allowed. Arabic required, optional Franco falls back to Arabic. Save incomplete drafts, but validate all six questions and ready media atomically before a pack is playable. No CSV or automatic duplicate detector. |
| Media and hints | Optional ordinary-question/answer images; format-specific required images/audio. Blur/zoom has three editable positive decreasing point stages starting at the tile cap, with agreed defaults. |
| Public edits | Staff may edit public packs after warning/confirmation. Existing games keep their starting content/media; new games use edits. A correction keeps question identity; replacement creates a new identity. |
| Archival | Hide archived categories/packs from new games without rewriting history. Category archival preserves individual pack status. Old completions remain; replaced content can show Updated. |
| Freshness | Prefer packs unseen by every tracked signed-in starting player. If exhausted, choose another category or explicitly accept repeats. Record exposure on first opening. Anonymous players have no guaranteed cross-game tracking. |
| Roster and progress | Freeze identity/team at start. Original players reconnect; newcomers wait for the next game. Disconnect preserves eligibility; explicit guest leave releases the account and stops future credit. Mid-game sign-in starts account progress next game. |
| Completion | Resolve all six questions within the same game, including no-winner outcomes. Partial attempts across different games never combine. Same-game resume preserves progress. |
| Teams | Guests choose a team before start; the host may be neutral. A team needs no minimum connected member count. Manual total correction does not rewrite original question/category awards. |
| Invitations | Six random numeric digits including leading zeros; QR/share links. Valid for 24 hours from issue, with host rotation. Code expiry stops admission while original players can still recover their seats. |
| Replay readiness | Keep lobby names/team choices, but require fresh non-host Ready for each new game. Host may remove absent lobby members before start. |
| Recovery and ownership | One active game per signed-in account. Private saved guest credentials restore the same seat; lost guest credentials/new devices cannot reclaim by name/code. Same signed-in host may take over another device and revoke the old controller. No host transfer. |
| Game lifecycle | Host End/explicit leave ends for everyone. Disconnect/app closure can resume before 24 elapsed hours of gameplay inactivity. Reads, heartbeats and reconnect alone do not renew it. Automatic finish on resolution 36; terminal scores are locked. |
| Timers and audio | Automatic 60-second answering timer, host pause/reset, unlimited audio. Memory viewing is manual and untimed; first hide starts the answer timer. Revisits do not reset it. Returning to board preserves progress and remaining time. Timeout alone does not reveal/award. |
| Awards | Suggested points follow the current hint stage; host may award zero through the original tile cap, or select no winner. Manual correction accepts a nonnegative target and records the difference. |
| Game payment | Host pays exactly one token at accepted start; guests/lobby/reconnect/resume/takeover are free. Rejected starts charge nothing. Ending/expiry restores once only if no question ever opened. |
| Platform failure | Recover the saved game first. Admin may restore one token once for a verified unrecoverable failure, with reason/audit and original debit reference. Client timeout alone is insufficient. |
| Token bank | All paid, gifted, promotional and complimentary tokens join one nonexpiring bank. No customer cash-out/purchase-refund feature, source-lot spending priorities or expiring token balances. |
| Shop | Base 100 EGP/token. Fixed 1/2/5 selectors and whole custom quantities 1–20. Equal quantity means equal price. AdminJS manages quantity discounts; order prices are frozen. |
| Discount order | Quantity discount first, then the better eligible gift or promo discount. Gift/promo do not stack. Valid discounts may reach 100%, never exceed it or create a negative amount. |
| Promos and free offers | Codes target one fixed bundle with an end date; matching counter quantity qualifies. Default one successful use per buyer, optional global cap. Automatic free campaigns remain with corresponding bundle/date/buyer/global controls. Valid free orders settle locally without Paymob. |
| Promo reservations | Reserve allowance at checkout, consume on accepted paid/free settlement, release only after confirmed final-unpaid closure. Unknown outcomes stay held; consumed uses do not reset after token restoration. |
| Gifts | Block self-gifts by buyer account/verified phone. Bind existing recipient at checkout or bind once after verified claim. Payment retries/phone changes never redirect a bound gift. Unclaimed gifts never expire. Admin may correct an unbound phone after a verified buyer request and audit. |
| Payment evidence | Web uses verified Paymob financial facts/amount/integration. Native uses signed Apple purchase evidence or Google API purchase state with unique store identity; pending receives no credit. Both fulfill an order once, retain later reversals and use reconciliation for exceptions. |
| Native checkout | Personal fixed 1/2/5 bundles. Aim to match website EGP where store pricing permits; actual store price is authoritative. Complete/consume after bank credit, with recoverable retries. Gifts/promo checkout stay web. |
| Native recovery | First authenticated verified unmatched claim may bind once to its own bank; existing account/order links never move. Store-offer limits stay separate from website promo limits. |
| Player identity | Display name, verified Egyptian WhatsApp phone and Arabic/Franco preference. Separate Firebase-managed login from staff email login. No required player email, DOB, gender or avatar. |
| Phone changes | Verify old/new numbers, keep the same account/bank/progress/bound gifts, reject an already-owned number and never merge accounts. Lost-old-number recovery is verified support work. Self-service remains included. |
| Staff | Admin handles all operational content/pricing/promos/grants/support/financial actions; Super Admin additionally manages staff accounts/roles. Persistent staff sessions and one relevant action audit. Complimentary credits require reason and audit. |
| Feedback and contact | Host-only editable Like/Dislike after reveal, including retained history, without rewards/comments requirement. Persist Support/Experience/Business submissions in an Admin open/closed inbox. No email/ticketing integration. |
| Public content | Keep AdminJS-managed pages, their media, branding and public contact/social configuration. Use fixed validated schemas. |
| Deletion | Leave/end active play first; explicitly confirm forfeiting the remaining bank without cash refund. Anonymize/delete personal data while retaining necessary IDs/evidence and valid gifts for other recipients. |
| Retention | Full copied game content for 12 months after ending, then compact results, original question IDs and progress remain. Purge old copied payload/media pins; current catalog and token lifetime remain unaffected. |

The full numbered interview and superseded answers are in [design-session.md](design-session.md); evidence and overrides are in [requirements.md](requirements.md). Earlier cash-refund allocation answers and the proposed final-review phase were superseded by later user answers.

## Technical choices and verification limits

UUIDs, precise SQL types/indexes, minor-unit rounding and bounded configuration shapes are technical design choices. Actual quantity-tier discounts are not yet configured; the inherited 10% gift default is still a proposal, not a newly confirmed business percentage. OTP/session/receipt operational retention and approved financial evidence retention still need their final implementation policy. PostgreSQL version, ORM, actual Paymob merchant adapter and native store/SDK configuration have not been selected by this document.

Client countdowns use persisted server deadlines. Accepted mutations commit to PostgreSQL before acknowledgement; cache contents can be rebuilt after restart. Cache visibility/revision keys and invalidation must preserve answer secrecy and current authorization. Start/payment/token operations never rely on a cached balance or allowance.

DBML export and exact FK-target checks now accompany executed PostgreSQL 18.6 DDL, selected positive/rejection and concurrent SQL/reference transactions, and synthetic query plans. These establish the recorded local results; API/provider integration, deployed capacity and production readiness remain separate. The [status document](schema-status.md) records the current checkpoint.

## Final policy decisions, accepted 2026-11-03

| ID | Decision | Accepted answer |
| --- | --- | --- |
| Q84 | Can a removed lobby member rejoin? | Block the known account until the host lifts removal; revoke its old credential. |
| Q85 | Can feedback change after copied content is purged? | Keep compact votes, close voting when the exact content is purged. |
| Q86 | Can deletion proceed with unresolved incoming funding? | Settle/review it first, then reconfirm the exact bank forfeited; block new funding/binding during deletion. |
| Q87 | Does same-phone account recreation reset free allowances? | Retain a campaign-scoped keyed phone fingerprint until campaign end. |

The user explicitly selected all four recommendations on 2026-11-03. The earlier 37-table choice alone had not answered them. They are now represented by removal/unblock, vote/purge, funding-review/deletion and campaign-fingerprint fields plus companion guards.

The [native billing design](native-store-billing.md) documents the two added records, proof methods, nullable historical store money, exactly-once credit and completion/recovery scenarios. The latest Q90/Q91 simplification supersedes the earlier all-quantities/native-gifting answers.

## Quality improvements

The [v1.2 quality review](design-quality-review.md) records every refinement and its evidence: 39 tables retained, smaller named channel checks, frozen order digest, typed financial observations, atomic sourced credits, native completion after bank delivery, monotonic proof projections, explicit unpaid closure, accepted Q84–Q87, one-way redaction and sparse indexes. The current design has 87 FKs, 304 CHECKs and 148 indexes including 19 partial indexes; see [status](schema-status.md) and [ADR 0010](../adr/0010-ledger-projection-and-postgresql-integrity.md). Admin still manages all operations; only staff management requires Super Admin.
