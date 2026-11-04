# Sahsah database evidence and unresolved rules

Reviewed: 2026-11-03. These are observations and source claims, not a completed product specification. User decisions override source proposals.

## Source authority

| Source | What it establishes | Limitation |
| --- | --- | --- |
| [Repository instructions](../../AGENTS.md) and [README](../../README.md) | Independent applications; NestJS owns AdminJS; prototype remains independent; new applications are starters | They do not define production gameplay/business policies |
| [Final quotation source](../../../sahsah_designs/quotation_sources/final-quotation.md), corresponding to `SahSah_Final_Quotation.pdf` | Proposed delivery scope, web/mobile connected gameplay, PostgreSQL, Paymob, identity integration, content and commerce requirements | It is a proposal; no evidence of signed approval or reliable chronology was found |
| [Current prototype source](../../sahsah_prototype/src/lib/game-rules.ts) and demo/UI extensions | Existing behavior, local presentation constraints, exact data flow and shortcuts | Existing behavior is not automatically a production policy |
| [Prototype gameplay guide](../../sahsah_prototype/docs/prototype-gameplay.md) and [archived modes prompt](../../sahsah_prototype/docs/new-question-modes.md) | Intended/past presentation behavior and mode requirements | Several rules conflict with current code |
| `system_research.pdf` and `tech_analysis.pdf` in `sahsah_designs` | Candidate architecture, entities, queries, performance targets and open policies | Research proposals include broader scope than the final quotation |
| `paymob_architecture_security.pdf` in `sahsah_designs` | Proposed payment/accounting boundaries and failure cases | Its page 16 requires merchant API contract verification before adapter finalization |
| [Flowchart README](../../../sahsah_designs/excaldrawAndImages/SahSah_Flowcharts_README.md) and four editable diagrams | Product journeys, board shape, staff actions and media flows | Workflow maps explicitly are not final backend specifications; some conflict with quotation/current code |

The PDFs contain no useful creation/modification metadata; “final” is not proof of a signed agreement. In interview Q1, the user accepted this working hierarchy: user decisions first, final quotation for scope, current prototype for gameplay evidence, with conflicts resolved explicitly.

## User decisions after the source review

Latest overrides: Q89 permits Admin all operational actions and reserves staff-account/role management to Super Admin. Q88 adds native Apple/Google billing; latest Q90/Q91 selects fixed 1/2/5 personal native purchases with website gifts/promos/custom 1–20. Q92 aims to match web EGP prices; Q93/Q94 settle separate offer limits and first verified unmatched claim. The quotation's native-billing exclusion is superseded; older role labels below are historical where inconsistent. See [the scope review](payment-and-staff-scope-review.md).

- Q2: a reusable room contains separate games. Replay must preserve a previous game's history rather than reset it in place. See [the accepted ADR](../adr/0001-separate-rooms-and-games.md).
- Q3: the content bank is authored in AdminJS. A category such as Football contains many fixed six-question **question packs**, and users see completed/remaining packs. The earlier independent-random-question proposal is superseded; subsequent answers define selection, progress and reuse below.
- Q4: launch with one NestJS service and one PostgreSQL service on Railway, considering $5 Hobby initially and $20 Pro later; **six people total including the host**, clarified on 2026-10-24; approximately 4,000 questions with about 70% containing good-quality Cloudflare-hosted images. Concurrency is unknown. The earlier seven-connection assumption and earlier illustrative workload are superseded.
- Q5/Q6: a board uses one fixed six-question pack from each of six categories; the host can choose packs with an unplayed default. All published packs are included through game tokens, without separate pack purchases.
- Q7: prefer group-fresh authored packs for all tracked signed-in players; when none is fresh, ask the host to choose another category or explicitly accept repeats. Per-user randomized pack contents were not selected.
- Q8/Q10/Q16: completion requires all six questions resolved, including no-winner outcomes; exposure is recorded on opening. The signed-in starting roster receives progress despite temporary disconnects.
- Q9: staff manually create packs with six question records and image/audio content through AdminJS. Each question record belongs to one pack. Semantic duplicates across separately authored records are a staff responsibility; automatic duplicate detection/warnings are explicitly deferred.
- Q11: playing roster freezes at start; original players reconnect and new players wait for the next game.
- Q12/Q13: public packs may be edited after warning/confirmation. Existing games keep copied starting content; new games use the edited catalog. Immutable public-pack revisions/new-pack replacement are not required editing workflows.
- Q14/Q17: ordinary edits retain question identity/history; replacement creates a new question ID in the same pack slot. Preserve earlier completion history and flag the current pack Updated without crediting replacement questions automatically.
- Q15/Q18: an account has one active game; explicit guest departure releases that claim and stops future credit while preserving prior history. Temporary disconnect does not release it.
- Q19: mid-game sign-in does not attach account progress to the current guest participation; account-based history starts next game.
- Q20: require all six resolutions within one game; same-game resume preserves progress and separate partial attempts do not combine.
- Q21–Q24: host departure/End game finalizes for everyone; app closure/disconnect stays resumable before 24 elapsed hours without meaningful host gameplay action. Expiry releases claims and preserves history. Same-account device takeover revokes the old controller without another token.
- Q25–Q28: host funds one token for the game; guests/lobby/reconnect/resume/device switch are free. A rejected start charges nothing. Ending/expiry restores one token only if no question ever opened; verified unrecoverable platform failure permits one reasoned staff restoration after recovery is attempted. Paid and paid-gift tokens do not expire. These are not cash-refund rules.
- Q29: 1/2/5 presets and custom quantity **1–20**; server-calculated prices are frozen on orders. Prototype quantity 999 is historical evidence and is superseded for production design.
- Q30: gift claim uses verified recipient phone; paid gifts credit an existing matching account or are claimed after verified registration, never the sender's wallet.
- Q31: use only the larger eligible gift/promo discount; no stacking, and token quantity stays unchanged.
- Q32: a designated privileged staff role may issue nonexpiring complimentary credits, with a required reason and audit, through ledger movements.
- Q33/Q37/Q38: production base price is **100 EGP per token**, with editable quantity tiers for presets and custom quantities equally. Quantity discount applies first, then one winning gift/promo discount. Prototype 10 EGP and flat pricing without bundle discounts are superseded. Actual tier thresholds/percentages are not launch data yet.
- Q34: gifts cannot target the buyer's own account or verified phone.
- Q35/Q42: promo codes have configurable dates/global caps and default to one successful use per purchasing account, with checkout holds and confirmed-unpaid release.
- Q36: staff have separate email-based identities/roles from player WhatsApp/Firebase accounts.
- Q39: bind an existing verified recipient account at checkout; otherwise bind once on a verified claim. A later payment retry/phone change cannot redirect the gift.
- Q40 historical answer, superseded by Q89: the earlier Content Admin restriction no longer applies. Current Admin manages all operations; Super Admin additionally manages staff accounts/roles.
- Q41: valid configured/code discounts may reach 100%; accept a zero-cost order and grant once without Paymob. No percentage exceeds 100% and no amount goes negative.
- Q42: reserve scarce promo allowance at checkout, consume on successful paid/free settlement, and release only after confirmed closure unpaid. Browser timeout/unknown outcomes do not release it. Consumed use is not reset by an unused game/token restoration.
- Q45/Q45a/Q47 latest clarification: all sources join one nonexpiring bank until spent. There is no customer cash-out/purchase-refund feature; source allocation and ordinary cash-refund reservations/valuation from Q43/Q48 are superseded for the current product. Keep funding history and exceptional provider reversal/reconciliation without introducing separate banks or ordinary refund APIs.
- Q46/Q46a: each code targets exactly one fixed 1/2/5 bundle and has an end date. Its exact quantity qualifies through the preset or counter; other quantities do not.
- Q49/Q50: automatic 60-second answering clock with host pause/reset; unlimited host-controlled audio replay without an extra token charge.
- Q51/Q53: memory viewing is manually shown/hidden/revisited without a viewing countdown. The first hide starts the 60-second answering clock; later revisits do not restart it.
- Q52: award defaults to current hint-stage points, with host override from zero through the original tile value.
- Q54: an unresolved question can return to the board and reopen with its hints, reveal and memory progress preserved; pause/preserve remaining time rather than reset it.
- Q55/Q56: manual corrections enter a new nonnegative team total, recording the difference without overwriting earlier awards. Category results retain the original question awards.
- Q57/Q60: scores lock on ending; the 36th resolution finishes automatically, so any manual correction must occur before it. No final-review phase.
- Q58: timeout alone does not reveal, resolve or award; the host still decides.
- Q59: two named teams do not require connected members; guests choose teams before start, host may be neutral, and assignments freeze at start. Six people total still includes the host.
- Q61/Q62: format belongs to each question and mixed-format packs are allowed; Arabic required, optional Franco-Arabic fields fall back to Arabic.
- Q63: incomplete drafts can be saved, but playable packs/public updates require all six valid questions and ready required media, saved atomically after any public-edit warning without reviewer approval.
- Q64/Q65: author all ten prototype formats. Blur/zoom have three editable, positive, strictly decreasing stage values beginning at the tile cap; defaults 600→400→200, 400→250→150 and 200→150→50.
- Q66/Q67: support optional ordinary-question and answer-only images. Archive/hide packs/categories for new games while retaining existing history; archiving a category does not rewrite individual pack status.
- Q68/Q69: six-digit invitation codes (leading zeros allowed), QR/share links, 24-hour validity from issue and host rotation. Replay can retain a valid code or issue another. Expiry is admission-only and separate from game inactivity expiry.
- Q70/Q71: immediate capacity-limited lobby join; host can remove before start. Private persistent guest credentials restore the same seat, while signed-in accounts can authenticate to recover. Lost anonymous credentials cannot reclaim by name/code.
- Q72: minimal player profile is display name, verified WhatsApp phone and Arabic/Franco preference; **Egypt phone numbers only** at launch. No required player email, DOB, gender or avatar.
- Q73: verify old and new phones for self-service changes; preserve account ID/bank/history/bound gifts; reject duplicate ownership without merging. Recovery without the old number is a support case.
- Q74: return to a lobby for every replay, preserving names/team choices but resetting non-host Ready confirmations; start snapshots only the newly confirmed roster and charges once.
- Q75: account deletion first requires leaving/ending active play and explicit confirmation of any remaining token-bank forfeiture, without cash refund. Personal-data deletion/anonymization and retained financial evidence need the remaining retention design.
- Q76: unclaimed gifts do not expire; Super Admin may correct only an unbound/unclaimed phone after a verified buyer request and audit. Bound-account ownership remains stable.
- Q77: automatic free campaigns also target one fixed bundle, end on a configured date, default to one accepted order per buyer and support a global cap/explicitly raised buyer allowance.
- Q78/Q79: distinct payments for one order are all recorded but grant once; extras require reconciliation. Honor verified exact late settlement once, flagging closed/released-promo exceptions; mismatches/deleted beneficiaries require reconciliation.
- Q80/Q81: host-only editable binary question feedback after reveal, including retained history, without rewards; persist the three Contact forms in a Super Admin inbox without email/ticketing integration.
- Q82 explicitly supersedes the quotation's CSV proposal: **manual AdminJS question/media authoring only; no CSV import feature or import tables.**
- Q83: retain full copied game text/media for 12 months, then preserve compact results/original question identities/account progress while purging old copied content and media pins. Current catalog remains; tokens do not expire.

On 2026-11-02 the user selected the approximately 37-table consolidation **retaining all features**, with simple staff administration. This changes physical storage, not the above product rules; see [the decision summary](decisions-summary.md) and [ADR 0007](../adr/0007-consolidate-launch-schema.md).

The user's latest illustrative inventory, 20 categories with 100 questions each, is 2,000 questions rather than the earlier approximately 4,000. It was presented as an example, not an explicit replacement launch commitment. At 100 questions/category there are 16 complete packs plus four loose questions; at 200/category there are 33 complete packs plus two. Inventory is discussed in [the freshness analysis](pack-freshness.md).

## Consistent product observations

- Host-controlled game, exactly two competing teams, six selected categories and six tiles per category. The current board point bands are `200,200,400,400,600,600`. Sources: [board creation](../../sahsah_prototype/src/lib/game-rules.ts#L260), [team types](../../sahsah_prototype/src/lib/game-types.ts#L105), final quotation p2 / source lines 32–38.
- The host opens a tile, reveals its answer, then awards one team or nobody. There is no current automatic verbal-answer judging, individual score, player answer submission, buzzer or persistent club/team model. Sources: [host actions](../../sahsah_prototype/src/lib/game-rules.ts#L429), final quotation p2.
- Game tokens pay for games and are distinct from team points. Current presentation charges one token at successful start/replay; lobby creation and reconnect/resume are free. Source: [gameplay guide](../../sahsah_prototype/docs/prototype-gameplay.md#L5), [wallet/start logic](../../sahsah_prototype/src/lib/store.tsx#L425), final quotation p3 / source line 54.
- The quotation calls for one connected NestJS backend serving web and Flutter hosts/guests, with persisted recovery and room isolation. Offline multiplayer is excluded. Source: final quotation pp1–2,6,8 / source lines 15–16,28–45,99,143.
- Guest joining does not require an OTP. The proposed signed-in identity flow uses Meta-delivered WhatsApp verification and Firebase sessions. Source: final quotation pp1,3 / source lines 17,53.
- Arabic RTL and Franco-Arabic LTR are the quotation's formats. The prototype's `promptEn`/“English” labels actually refer to Franco-Arabic. Sources: [question types](../../sahsah_prototype/src/lib/game-types.ts#L28), final quotation pp2,6 / source lines 39,93.

## Current implementation versus production needs

| Area | Observed implementation | Design consequence to discuss |
| --- | --- | --- |
| Persistence | Default presentation uses localStorage. Optional prototype service rewrites a JSON database; new NestJS starter has no database resources | Design actual durable ownership and transactions; do not copy local wallet/profile assumptions |
| Host identity | Random per-game bearer secret is separate from the browser profile | Account owner, host authority and authentication session are separate concepts |
| Guest identity | Join appends a name/team pair; roster names entered by host are separate local lists | A human roster member, an account, a guest membership and a connected device are not necessarily the same record |
| Question selection | One published record per category/row; publish archives its predecessor; board chooses that fixed record | Pool selection/difficulty/no-repeat policy is new design work, not an implemented fact |
| Content stability | Board creation clones question records | Preserve stable game content through revisions or snapshots if accepted; do not silently reference mutable catalog text |
| Replay | Same session ID/code/teams reset; history keyed by session ID is overwritten | Q2 settled: separate game occurrences inside the reusable room; design durable game-level history and token consumption |
| Concurrency | Session version rejects stale actions; current awards have a limited duplicate guard | Retain stale-command semantics with transactional once-only effects; JSON/browser locks are not multi-instance durability |
| Wallet | Browser wallet is shared across tabs and not scoped by an authenticated account | Production account ownership, token movements and spending integrity need a separate model |
| Gift | Sender order has phone/note and skips sender credit; no real recipient fulfillment exists | Q30/Q39 define verified-phone/stable-account delivery; verification/fulfillment, unclaimed/correction policy and exceptional payment reversals remain design work |

Source anchors: [service persistence](../../sahsah_prototype/server/engine.ts#L16), [demo persistence](../../sahsah_prototype/src/demo/service.ts#L76), [game creation/host](../../sahsah_prototype/src/lib/game-rules.ts#L286), [guest join](../../sahsah_prototype/server/api.ts#L323), [rosters](../../sahsah_prototype/src/lib/store.tsx#L280), [board clone](../../sahsah_prototype/src/lib/game-rules.ts#L260), [replay](../../sahsah_prototype/src/lib/game-rules.ts#L571), [content publication](../../sahsah_prototype/src/lib/game-rules.ts#L659), [frontend economy](../../sahsah_prototype/src/lib/store.tsx#L291), [backend starter](../../web_app/backend/src/admin/admin-dashboard.ts#L28).

## Conflicts requiring decisions

| Topic | Sources disagree | Status |
| --- | --- | --- |
| Payment gateway | Flowcharts say Fawry only; final quotation pp1,3,8 says Paymob only and excludes extra gateways | Q1 settled: quotation baseline, so Paymob is the launch provider |
| Commercial model | Research includes subscriptions/native billing/content entitlements; quotation source lines 54–64,143–146 narrows to one-time game-token purchases, website checkout and account-based mobile access | Q6 settled: published packs are included through game tokens; no extra pack entitlement at launch |
| Modes | Public prototype supports ten formats; server/admin model only five, with five newer formats implemented as demo overlays | Q61 places format on each question and permits mixed packs; detailed typed authoring/media contracts remain under design |
| Category meaning | Football is a topic while memory/voice can be presented as selectable categories | Q61 keeps category as a selectable grouping, with question format separate; Q9 retains one owning pack per question |
| Timer | Archived prompt line 16 says manually start; current UI auto-starts a 60-second timer after opening a question (after hiding the first memory picture) | Q49/Q53 accepted automatic 60 seconds, first memory hide trigger and explicit host controls |
| Audio replay | Gameplay guide/old tests describe three plays; current player explicitly permits unlimited replay and engine does not enforce retained `maxPlays` metadata | Q50 accepted unlimited host-controlled replay |
| Memory | Guide describes timed 10/7/5-second viewing and 30-second answer timer; current code manually shows/hides/revisits and uses the shared 60-second timer | Q51/Q53 accepted manual untimed viewing, 60 seconds from first hide and no automatic restart on revisit |
| Stage scoring | Archived prompt caps at current stage points; current host can choose up to original question points after hints | Q52 accepted current-stage default and override through original tile value |
| Returning to board | Engine resets time and only permits question phase; current UI has no return button | Q54 explicitly adds return for unresolved questions, including retained reveal, with paused remaining time |
| Manual score correction | UI converts an absolute target to a delta; engine clamps negative totals and also accepts finished-game adjustments through its API | Q55–Q57 require a nonnegative target, recorded difference, unchanged question/category awards and locked terminal scores |
| Turn/steal mechanics | Standard flowchart mentions another team stealing/next turn; detailed flow and current code provide host-directed selection without automatic turns | Do not add turn/answer-attempt/lifeline records unless accepted scope requires them |
| Capacity/latency | Research proposes 1,000 rooms with eight viewers plus host and different visibility/recovery targets; quotation excludes high-concurrency certification | Q4 replaced those proposals with launch constraints above; capacity/SLO still need measurement |

Current-code anchors: [ten public formats versus admin types](../../sahsah_prototype/src/lib/game-types.ts#L1), [demo overlays](../../sahsah_prototype/src/demo/party-modes.ts#L138), [timer auto-start](../../sahsah_prototype/src/pages/GamePage.tsx#L548), [unlimited audio](../../sahsah_prototype/src/components/QuestionAudio.tsx#L69), [audio acceptance](../../sahsah_prototype/src/lib/game-rules.ts#L587), [manual memory](../../sahsah_prototype/src/demo/service.ts#L190), [memory presentation](../../sahsah_prototype/src/demo/party-modes.ts#L130), [host scoring override](../../sahsah_prototype/src/lib/game-rules.ts#L523).

## Quotation scope that affects candidate records

- Staff content: categories, questions, products/prices, media, game defaults, public pages/branding, draft/publish, roles and controlled financial actions. The quotation's fixed CSV proposal (p3 / source lines 58–59) is superseded by Q82: manual per-question/media creation only.
- Commerce: the quotation proposes server-set prices, verified Paymob notifications, duplicate protection, purchase/access records, refund/status updates and basic reconciliation. The user's later Q45a excludes customer cash-out/normal refund workflows; actual provider reversals remain financial facts for internal reconciliation. Browser success is not authoritative. Source: final quotation pp3,7–8 / source lines 55,110,131 and subsequent user scope clarification.
- Gifts/promos and host question feedback are included; the later numbered decisions and final Q84–Q87 answers define their rules. The current prototype offers custom token quantity as well as 1/2/5 presets, while quotation line 54 only names the presets. Source: final quotation p3 / source line 57; [quantity rules](../../sahsah_prototype/src/lib/token-economy.ts#L3).
- Account deletion and agreed retention handling are acceptance requirements; no source supplies final retention periods. Source: final quotation p8 / source line 130.

## Useful research proposals, still unapproved

`system_research.pdf` pp19–21 proposes immutable question versions, board slots pinned to versions, media derivatives, score history, token accounting, delivery/retry records and query-specific indexes. These are candidates, not a mandate to create every listed table. The supplied PDFs leave cross-game freshness and pool exhaustion undefined; the user's Q7/Q10/Q11/Q15–Q20 answers now define those policies. Q12 explicitly permits public edits, while Q13 preserves a game's content with starting snapshots instead of requiring staff to create a new published pack for each change.

`paymob_architecture_security.pdf` p5 separates orders/items, checkout attempts, provider transactions, verified notification receipts, fulfillment grants, refund operations and reconciliation. Pages 5–8,12–13 explain why two actual transactions paying one order differ from one callback arriving twice, and why a later refund must not disappear behind transaction-only callback deduplication. These are proposed failure cases to verify against the actual enabled merchant integration, not an invented provider API contract.

`system_research.pdf` pp3,21,36 and `tech_analysis.pdf` pp14–15 propose capacity inputs; the final quotation p8 excludes certification for 10,000/50,000 simultaneous users. `system_research.pdf` p21 proposes viewer visibility below 500ms and recovery within 5s; `tech_analysis.pdf` p20 instead proposes viewer p95 at most 700ms and 99% recovery within 10s. Workload and SLOs remain interview decisions.

## Boundaries for technical recommendations

The deployed PostgreSQL version and ORM are unknown. Older research suggestions of Prisma/shared packages/separate AdminJS are not repository facts and do not supersede repository instructions. No Drizzle/Prisma choice, table partitioning, replica or complete event-sourcing strategy has been selected. PostgreSQL is authoritative and caching is rebuildable; a bounded local cache is the initial recommendation, without a selected package or deployed service.

Index order, nullable uniqueness, composite membership constraints, mutable-state contention and DBML export limitations must be checked against [the primary-source notes](postgresql-notes.md) and the eventual query inventory. Selected local query plans and footprints are now recorded in the [v1.2 validation](validation/README.md); production distribution and deployed capacity remain untested.

## Effective native scope after latest Q90/Q91 correction

Fixed native 1/2/5 personal bundles only; gifts and promotional checkout remain on the website, whose custom counter remains 1–20. Aim to match web EGP store prices where permitted. Existing links never move; first verified unmatched claim may bind once to its authenticated claimant. Native offer limits are separate if introduced. Two extra native records bring the consolidated schema to 39 tables. See [native billing](native-store-billing.md).

## Final boundaries and quality review, 2026-11-03

The user explicitly accepted all Q84–Q87 recommendations: block removed known accounts until host unblock; preserve votes but close voting after actual content purge; resolve/review pending funding before exact deletion consent; retain a campaign-local keyed buyer-phone marker until campaign end. The [v1.2 review](design-quality-review.md) documents technical improvements authorized by the user, including ledger-owned bank projection and verified settlement/credit guards. [Status](schema-status.md) distinguishes represented scope and executed disposable SQL from future API/provider/deployment validation.
