# Sahsah: implementation prompt and complete design handoff

Prepared 2026-11-04. Design checkpoint: **v1.2, validated 2026-11-03**.

Copy this entire document into the implementing model's conversation, or ask a model with repository access to read it completely and execute it. It contains the application context, final decisions, superseded answers, current implementation state, schema inventory, technical contracts, validation evidence and the next task.

The exact column/constraint/trigger definitions remain in the three schema inputs named below. For a model without filesystem access, attach those inputs and the relevant referenced documents along with this prompt; the prose alone cannot reconstruct every SQL definition faithfully.

---

## 1. Your task and the point at which to resume

You are taking over Sahsah as the backend/PostgreSQL engineer. **Implement the agreed PostgreSQL schema and the NestJS database foundation in the existing repository.** Carry the work through migrations, integration, tests and setup documentation; merely generating another diagram or implementation plan does not finish this task.

The previous conversation completed a large design interview and a subsequent quality audit. The user explicitly asked to avoid overengineering, especially staff administration. The resulting model retains the full agreed feature set in **39 domain tables**. The immediate next step is application-owned schema implementation. Actual gameplay, account, payment and admin workflows are described here so your database integration supports them correctly; implementing the entire website/mobile application is a later phase.

Start from:

```text
/home/girgis/repo/work/sahsah_company/sahsah_code
```

The external project research is in:

```text
/home/girgis/repo/work/sahsah_company/sahsah_designs
```

At handoff:

- The prototype remains a separate playable React/Vite presentation application.
- The new Next.js frontend, NestJS API and Flutter application are starters.
- The NestJS backend has an authenticated but empty AdminJS dashboard.
- There is **no PostgreSQL driver, ORM, database module, migration system or database-backed AdminJS resource in the backend yet**.
- Its staff login currently uses environment credentials and in-memory sessions. Planned `staff_accounts`/`staff_sessions` tables have not been integrated into that login.
- All previous database implementation code is **design SQL and a disposable validation harness**, not an applied application migration.
- No provider integration, Railway deployment, production migration or real payment was performed.
- The latest audit's temporary PostgreSQL servers were stopped. Start your own disposable database when testing; do not rely on old `/tmp` paths or a running audit instance.
- `CONTEXT.md` and `docs/` were untracked at the last repository inspection. Preserve this existing work and any subsequent user changes.

The first implementation increment is complete when the actual backend can configure a PostgreSQL connection, apply and inspect versioned migrations reproducing the agreed schema and guards, use a bounded pool and safe transaction boundary, and verify the resulting application schema with meaningful integration tests. Staff persistence and domain endpoints remain clearly identified follow-on work unless you implement them as part of a justified database integration slice. Never report a table's existence as proof its corresponding application feature is implemented.

After the required reading, execute the implementation sequence in section 17 and verify its completion criteria. Sections 4–14 are the application/schema contract; sections 18–20 resolve historical overrides and configuration gaps.

## 2. Authority, required reading and source hierarchy

Follow the latest explicit user instruction first. For the previous decisions, use this hierarchy:

1. Final accepted user answers and their later corrections, consolidated here and in [decisions-summary.md](decisions-summary.md).
2. [sahsah.dbml](sahsah.dbml), [postgresql-supplement.sql](postgresql-supplement.sql) and [postgresql-guards.sql](postgresql-guards.sql), together, for the current physical design.
3. [schema-status.md](schema-status.md), [design-quality-review.md](design-quality-review.md) and ADRs for the current checkpoint and technical rationale.
4. Detailed domain documents for write contracts and edge cases.
5. [design-session.md](design-session.md) for the numbered interview and historical answers.
6. The final quotation for original scope, prototype for presentation/gameplay evidence, and external research for investigated options.

Read these before changing application code:

- Root [AGENTS.md](../../AGENTS.md), [README.md](../../README.md), any applicable nested `AGENTS.md`, and [CONTEXT.md](../../CONTEXT.md).
- This entire prompt, [decisions-summary.md](decisions-summary.md), [schema-status.md](schema-status.md) and [table-guide.md](table-guide.md).
- All three schema inputs in full, including their notes and PostgreSQL functions/triggers.
- [design-quality-review.md](design-quality-review.md), [query-plan.md](query-plan.md), and [validation/README.md](validation/README.md).
- [ADR 0007](../adr/0007-consolidate-launch-schema.md), [ADR 0008](../adr/0008-regular-admin-operational-access.md), [ADR 0009](../adr/0009-native-store-purchases.md) and [ADR 0010](../adr/0010-ledger-projection-and-postgresql-integrity.md).
- The actual backend `package.json`, source, configuration examples and tests. Reinspect rather than assuming the snapshot below is still current.

Before implementing a domain write path, read its corresponding detailed references in section 16. Older documents contain historical phrases such as “no SQL execution,” separate grant/claim/team tables, pending Q84–Q87, or Content Admin. Those are superseded where they conflict with v1.2. Archived DBML files are historical comparison material.

Some original research is in PDFs and extracted quotation sources under `sahsah_designs`. The user did not approve every entity, capacity target or API assumption in those PDFs. Their “final” filename does not establish signed acceptance. [requirements.md](requirements.md) records source conflicts and the precedence of user answers.

## 3. Repository and implementation constraints

| Area | Current arrangement |
| --- | --- |
| `sahsah_prototype/` | Independent React/Vite presentation app, existing assets, behavior and lockfile. Its own instructions apply. |
| `web_app/frontend/` | Independent Next.js 16 App Router application, React, Tailwind CSS v4, shadcn/ui and Zustand. |
| `web_app/backend/` | Independent NestJS API, with AdminJS inside `src/admin/` and served at `/admin` on the same server. |
| `mobile_app/` | Independent Flutter source and Android/iOS platform projects. The user has explicitly prohibited installing Flutter or running local mobile builds unless that preference changes. |
| Repository root and `web_app/` | Containers, not Node packages or pnpm workspaces. |
| Existing Vercel project | Root Directory remains the repository root; root `vercel.json` builds only the prototype and preserves its SPA fallback. The new frontend is a separate deployment. |

Use Node **24 LTS** and pnpm **10.34.3**. Install/run from the affected application's directory and preserve independent lockfiles and frozen installs. Applications communicate over HTTP; there are no sibling source imports or shared `node_modules`.

The backend inspected at handoff is ESM (`type: module`) and uses `.js` specifiers in TypeScript source imports. Its manifest currently pins NestJS core/common/platform-express 12.2.0, AdminJS 7.8.17 and `@adminjs/express` 6.1.1. Inspect the manifest for the full current dependency set and overrides; preserve its compatible TipTap overrides. No Drizzle, Prisma, TypeORM or PostgreSQL driver has been selected or installed.

Backend startup currently establishes `/api`, CORS and a global validation pipe. `src/application.ts` mounts AdminJS before Nest's body parser/catch-all handlers; retain that middleware order. `/api/health` is the existing health endpoint.

The starter enables AdminJS only with `ADMIN_ENABLED=true` plus `ADMIN_EMAIL`, `ADMIN_PASSWORD` and `ADMIN_SESSION_SECRET`. It validates the starter password/secret lengths, uses an HttpOnly/SameSite cookie scoped to `/admin`, and requires production HTTPS/trusted-proxy configuration. These environment credentials and memory sessions are the current scaffold, not the final separate staff-account design. Clearly document any authentication transition you actually implement.

Do not migrate prototype gameplay or redesign the frontend/mobile applications as part of this schema increment. Preserve existing application tests and explain intentional configuration changes. Local work and disposable test databases are in scope; applying migrations to an existing remote/production database or deploying requires a separately identified target and authorization.

## 4. Product, workload and architecture decisions

Sahsah is an Egyptian social trivia game. A signed-in host controls the board, reveal, timing and awards for two teams. Other people can participate anonymously. The host controls adjudication; this scope does not introduce individual answer submissions, buzzers, reusable clubs or a turn-owner system.

- A **room** is the reusable invitation/lobby space. A **game** is one separately charged, separately recorded 36-question play through a board in that room.
- Maximum **six people total, including the host**. The old seven-person arithmetic was corrected explicitly.
- Each game selects **six distinct categories**, one authored six-question pack from each, giving **36 questions**.
- Each pack has tile positions worth **200, 200, 400, 400, 600, 600**.
- Categories contain many packs; a question identity belongs to one authored pack. All published packs are included through game tokens; packs are not separately sold/unlocked.
- The launch estimate is about **4,000 questions**, approximately **70% with good-quality images**, stored/delivered through Cloudflare. Audio is supported too.
- The user's later example of 20 categories × 100 questions illustrated an idea, not a fixed replacement for the 4,000-question estimate. Neither 20 categories nor 100 questions/category is a schema limit. Loose questions may remain in drafts until a complete pack exists.
- Initial deployment: **one NestJS service/process and one writable PostgreSQL primary**. “One database replica” in the conversation meant this single instance, not an additional read replica.
- Railway budget intent: possibly $5 initially, then approximately $20/month, with slow early growth and no measured concurrency forecast. Budget tiers do not select fixed CPU/RAM or guarantee room capacity.
- Previous research proposed about **100 concurrent full rooms / 600 people** as an initial target, **100–250 rooms / 600–1,500 people** as a conditional planning range, and 500 rooms as a favorable stretch case. These are estimates under explicit CPU/memory/handler assumptions, not measured Sahsah capacity or a promise at $5/$20.
- The published region/pricing/network figures in the October research are dated research. Verify current official facts before provisioning; do not silently turn those figures into deployment guarantees.

PostgreSQL owns accepted games, scores, controller/account claims, exposure/completion, banks, ledger, orders, promotion allowance, payment evidence, staff state and durable work. A process restart or empty cache must not erase accepted decisions.

For one API process, bounded local catalog/config caches and disposable socket/presence maps are the initial recommendation. Redis is not required or installed. Cache keys/projections must preserve content revision and visibility/authorization. Cached balances/allowances do not authorize spending or free orders. A socket has no dedicated database connection, and countdown ticks/heartbeats create no per-second database writes.

Cloudflare stores the image/audio bytes; PostgreSQL stores metadata, identities and relational references. Private source/answer assets require authorized delivery. Bounded PostgreSQL outbox workers can run in the existing NestJS service. No extra queue/worker service, read replica, partitioning, full event sourcing or dynamic permission framework is justified for this launch merely by the 4,000-question bank.

## 5. Catalog, formats, editing and media

Staff manually create categories, packs and individual questions/media in AdminJS. **CSV import and automatic duplicate detection were explicitly excluded.** Repeated text/meaning across separately created question identities remains possible; do not add uniqueness on prompt text, image checksum or semantic hashes.

A draft can be incomplete. Publishing, restoring a playable pack or saving public changes validates all six current slots, the point bands, Arabic prompt/answer, format configuration and ready required media under the pack lock. Save a valid public update atomically after warning/confirmation. No reviewer approval step or immutable-public-pack restriction was accepted.

Arabic is required for playable question/answer content. Franco-Arabic is optional with field-by-field Arabic fallback. Franco is Arabic written with Latin characters/numerals, not an English translation. Normalize absent optional values; do not reject valid names/transcripts merely because they contain mixed scripts.

All ten formats are launch scope, owned by each question; mixed-format packs are valid:

| DB enum | Format and content contract |
| --- | --- |
| `STANDARD` | Ordinary question/answer; optional prompt image and suitable answer-only image. |
| `IMAGE_BLUR` | Private original and three ready progressively clearer blurred hint images; full reveal image. |
| `IMAGE_ZOOM` | Private original and three ready zoom/crop stages; full reveal image. |
| `AUDIO_GUESS` | Playable sound and textual answer; unlimited host replay. |
| `AUDIO_REVERSE` | Forward source and generated reversed question audio; textual answer/transcript. |
| `IMAGE_PERSON` | Portrait/question crop and identity answer; full image at reveal. |
| `IMAGE_COLOR` | Grayscale question rendition and original color image at reveal; textual answer. |
| `IMAGE_RIDDLE` | Illustration and Egyptian-proverb answer. |
| `AUDIO_VOICE` | Audio clip and identity answer; optional localized hint. |
| `IMAGE_MEMORY` | Scene plus detail question/answer; manual show/hide/revisit and first-hide answering timer. |

Three blur/zoom hint stages use editable, positive, strictly decreasing suggestions beginning at the original tile value:

| Tile | Default stages |
| --- | --- |
| 200 | 200 → 150 → 50 |
| 400 | 400 → 250 → 150 |
| 600 | 600 → 400 → 200 |

The host may override the suggested award from zero up to the original tile cap. Media roles include source, question, answer and numbered hints. Source/answer references and unrevealed variants remain private server data. Production renditions should avoid sending a full reveal image merely to mask it with CSS.

Ordinary edits preserve the question's logical identity and seen history. **Replace question** retires the old identity and creates a new ID in that slot. Retired identities remain referenced by history. `content_revision` advances on accepted content changes for stale editor/cache detection, but a typo edit does not become a fresh unseen question.

Each accepted game keeps starting content/configuration and exact media pins. New games use later edits; running games are not rewritten. Current catalog membership is checked at start, then saved historical category/pack/question relationships retain their original meaning even if the current catalog later changes.

Archive hides a category or pack from new starts while preserving existing games/progress. Category archival does not rewrite each pack's state; restoring a category exposes its otherwise valid published packs again.

Use immutable object keys for every uploaded/generated revision. Do not store bytes, secret-bearing delivery URLs or expiring signed URLs in snapshots. Validate type/size/dimensions/duration, processing readiness and transform ranges. `game_question_media` relational pins support safe collection; JSON IDs alone are insufficient. Ready object bytes cannot be overwritten while retained references need them. Image/audio processing and external storage I/O occur outside short gameplay transactions. Cloudflare R2/private presigned delivery was researched; the actual Cloudflare product/bucket/configuration has not been provisioned or mandated by user fiat.

## 6. Freshness, progress and starting roster

Use stable authored packs and group-aware selection. Per-user shuffled pack numbers/content were considered and rejected as the solution. A display number does not establish unseen content.

For the signed-in starting group `G`, a pack is wholly fresh only when none of its **six current question IDs** has exposure for **any** account in `G`. Prefer an eligible fresh pack in the chosen category; expose the actual selected content/pack to the host before accepting start. If no fresh pack exists, the host explicitly chooses another category or accepts repeats. Recheck repeat consent against the actual selected content and fixed roster at start. Exact substitution presentation is a UI detail, not permission to silently relabel repeated content as fresh.

An opened question creates exposure even when it is never resolved. Completion means **all six resolved in the same game**, including no-winner outcomes. Distinguish unplayed, exposed/in-progress, historically completed and current Updated status. Different games' partial results never combine; same-game resume preserves progress.

Freeze account identity and team assignment at game start:

- Signed-in starting participants receive exposure/completion despite temporary disconnects.
- An explicit guest departure marks the historical seat left, releases that account's matching active claim and stops future exposure/completion credit. Prior history remains; the seat is not replaced in the active game.
- A guest signing in mid-game remains that game's original anonymous identity. Account freshness/progress begins with the next game; no backfill.
- Anonymous players have no guaranteed persistent cross-game tracking.
- New people join the next game; original participants can reconnect.
- One active game per signed-in account prevents simultaneous game selection against the same history. Account pointers prove roster membership through the composite FK; services must enforce current lifecycle eligibility and release claims.

After replacement, preserve old completion history and flag the current pack **Updated**. The new question is not automatically exposed/completed; one new question does not make the other five unseen. Compare current IDs against compact historical source identities. Staff-created semantic duplicates cannot be recognized automatically under the agreed scope.

Use set queries/anti-joins over at most six account IDs, current pack questions and indexed exposures. Avoid fetching entire histories into Node or querying one pack/account at a time. Do not materialize an “unplayed” row for every user/pack combination. A rebuildable summary is a later measured optimization.

## 7. Rooms, invitations, identity and recovery

An authenticated host owns the room. Guests join immediately with name/team if a seat is available; anonymous guests do not need OTP or host approval. Capacity is checked under the room lock and includes/reserves the host seat. Guests choose team 1 or 2; the host may be neutral. Neither side requires a minimum number of connected people.

Invitations are six random numeric characters, including leading zeros, plus QR/share links. Keep codes as text. They remain unique while assigned and valid for **24 elapsed hours from issue**. The host can rotate. Replay keeps a valid code or issues a new one. Expiry/revocation stops new admission; it does not end the game or prevent recovery by original members.

A public invitation is a locator, not a reconnect secret. Anonymous reconnect uses a private high-entropy credential saved by that browser/app; store its hash and revoke on departure/removal. Refresh/restart reuses the seat. If the secret is lost or the guest changes devices, name/code alone cannot recover that active seat; wait for the next game. Signed-in people recover their own membership after authentication.

The host may remove people **before start**, not kick them out of an active game. **Q84 is accepted:** a removed known account stays blocked from that room until the host explicitly unblocks it. Preserve the removed old membership and revoked old credential; unblock permits a fresh eligible join, not revival of the old secret. This does not identify the same human behind a new anonymous credential; rotate the shared invitation if needed.

For replay, retain names/team preferences in the lobby. Each non-host confirms Ready again for the new game/generation. The host removes absent lobby people before starting. Only the newly confirmed roster freezes; one new host token is charged when the start succeeds.

Player profile: display name, verified **Egyptian** WhatsApp phone and Arabic/Franco preference. No required player email, birth date, gender or avatar. Canonical phone checks plus appropriate number metadata and OTP ownership validation enforce scope; a broad `+20` regex alone is not full validation.

Identity integration design: the backend verifies Meta/WhatsApp-delivered OTP, issues a Firebase custom token, and the client exchanges it for Firebase-managed sessions. NestJS verifies Firebase **ID tokens**. Firebase itself is not the WhatsApp OTP sender. Reuse a stable local account/Firebase UID across phone changes. Store project/UID mapping, not a duplicate table of ordinary Firebase refresh sessions. Provider revocation/local account-state checks remain necessary.

OTP challenges store purpose/account association, keyed MAC and key version, attempt limit, expiry and verified/consumed/invalidated timestamps. Secrets remain outside PostgreSQL; no plaintext OTP. Delivery receipt is not ownership proof. Consume a fresh proof once under locks. The proposed five-attempt default is operational configuration, not a user-selected commercial rule.

Self-service phone change verifies both old and new numbers, preserves account/bank/history/bound gifts, rejects another account's number and never merges accounts. Lost-old-number recovery requires verified, audited staff support plus new-number proof, not an automatic transfer. External Firebase/Meta calls need durable retry/reconciliation, not a claimed SQL transaction across providers.

## 8. Game lifecycle, controller, timer and scores

Only the same signed-in host may explicitly take control on another device. Rotate the controller credential hash and advance `controller_generation` under the game lock; later old-device commands fail. Same-game takeover/resume costs no token. There is no host transfer to another participant at launch.

Deliberate host End/Leave is terminal for everyone. Closing the app or disconnecting is resumable until **24 elapsed hours without meaningful host gameplay**. Reads, socket heartbeats, reconnect and takeover alone do not renew this deadline. Finalization releases matching active claims, stops clocks and preserves history. A late request cannot revive an expired/ended game.

Acquire the game lock and then sample fresh database time. Use `timestamptz`, elapsed `interval '24 hours'` for inactivity, and `Africa/Cairo` for presentation. A transaction-start `now()` sampled before a lock wait can be stale. Request handlers enforce expiry even if the bounded sweep is delayed.

Ordinary questions automatically start a **60-second** answering timer on first opening. Host pause/reset is allowed; audio replay is unlimited. Memory viewing is untimed and manually shown/hidden/revisited; its answering timer starts on the **first hide**. Later revisits never automatically restart it.

Returning to the board before resolution preserves stage, reveal, memory state and remaining time. Pause/checkpoint the clock and reopen with that remainder. The current design distinguishes navigation pause from deliberate host pause: reopening resumes the former; explicit pause remains paused. Reset explicitly restores 60 seconds without erasing exposure/hints/history. The precise auto-resume behavior of the reset button was a proposed UI interaction, not another answered product question; it need not be invented during schema implementation.

Persist timer state (`ready`, `running`, `paused`, `elapsed`), remaining checkpoint and absolute deadline, not one update per second. Only a running timer has a deadline; display remaining time from server time/deadline. A passed deadline may be normalized on the next command. At most one unresolved current question can run per game; services enforce this under the root game lock. Reaching zero does **not** automatically reveal, resolve, select no winner or award points.

Resolve after reveal, once. A chosen team's award is an integer from **zero through the original tile cap**; current hint-stage points are the suggestion. No-winner resolution awards zero and still counts toward pack completion. Winner-with-zero remains distinguishable from no winner. For a winner, record the matching award score effect even at zero; no winner has no team award effect.

Manual correction takes a nonnegative **absolute new team total**, records `new − old`, and updates the projection in the same transaction. Example: 600 → 400 records −200. Preserve original question awards/category attribution. An unchanged target is a no-op; a negative request is rejected. Score totals are typed as bigint, so API integer/JSON handling must be explicit.

**The 36th resolution automatically finishes and locks the result**, stops timers and releases claims. No final review/Confirm Finish phase. All manual corrections must precede the last resolution or an earlier ending. Feedback is separately authorized and can remain editable after the score lock until actual content purge.

Host mutations authenticate current host/controller, validate expected version and canonical request identity, then serialize the state transition on the game. Check a previously accepted identical command before rejecting its old expected version. Same key with a different payload conflicts. Durable start/resolution/ledger identities survive ordinary receipt cleanup. No-op/retry acknowledgements do not renew inactivity or repeat scores/tokens. Commit before publishing permitted state.

## 9. Token bank, game charges and pricing

One token funds one complete 36-question game for all people. The **signed-in host pays exactly one token at accepted start**. Lobby creation, guests, reconnect, same-game resume and same-host device takeover are free. A rejected start commits no game/debit.

Accepted start is one transaction: validate owner/readiness/roster, lock/recheck accounts/catalog/freshness/repeat consent, create the game and all six pack/36 question copies/media pins/frozen players, claim signed-in accounts, and insert the host's unique debit. Failure rolls everything back.

All purchased, gifted, promotional and complimentary tokens enter **one permanent nonexpiring bank**. Unclaimed gifts do not expire either. There is no customer cash-out/purchase-refund feature, token-source balance, reserved refund bank, FIFO/free-first spending allocation or source-lot bookkeeping.

The bank write contract is critical:

- `token_ledger_entries` is append-only and every movement has an eligible source.
- New accounts begin with zero balance. Insert a sourced credit to fund them.
- The ledger INSERT trigger alone adds the signed amount to the locked account bank in the same transaction. **The application must not separately increment/decrement `accounts.token_balance`.**
- The nonnegative account CHECK rejects overspending. Unique source keys prevent duplicate delivery even with a new request key.
- Do not scan/SUM the entire account ledger on each write. Full-history reconciliation is separate work.
- Credit comes from one uniquely settled order or one authorized reasoned staff audit. A game debit is exactly −1. Game restoration is +1 against that original typed debit/account/game. Deletion forfeiture is the exact confirmed negative remaining bank.

If a successfully started game ends/expires **before any question ever opens**, append exactly one +1 restoration to its original payer. Once a question opens, voluntary ending/idle expiry retains the charge. First opening is sticky and cannot be cleared by reset/navigation/editing. Preserve the original −1 entry; restoration is a distinct movement.

On platform failure, recover the same saved game first. For a verified unrecoverable failed game, authorized staff can restore one token once with reason/audit and original debit reference. A client timeout is insufficient. Automatic and staff paths cannot restore the same debit twice. A provider refund/revocation is financial evidence, not this game restoration mechanism and not an automatic negative-bank policy.

Website pricing:

- Base **100 EGP/token**, stored as **10,000 minor units**. The prototype's 10 EGP price was overridden.
- Presets **1/2/5**, plus a whole-number custom counter **1–20**, not 999.
- Same quantity has the same price through preset/custom selectors. AdminJS manages quantity tiers; presets are shortcuts, not independently priced duplicate SKUs.
- Apply the quantity reduction first, then only the better eligible **gift OR promo** discount. Gift/promo do not stack with each other.
- Discounts may reach **100%**, never exceed it or create negative totals.
- Freeze quantity, unit price, tier/version, campaign identity, reductions, payable amount and recipient on the order. Price edits never recompute accepted orders.
- Use exact integer/numeric arithmetic and the recorded per-reduction minor-unit rounding checks. Percentages use basis points, with 10,000 = 100%; avoid binary floating-point money.
- Actual launch tier percentages are not supplied. The inherited 10% gift-discount default in design SQL is a **technical proposal**, not a newly confirmed business percentage. A quoted 20% tier/10% promo example was illustrative.
- The quote proposal favors the gift benefit on equal savings so an unnecessary code use is preserved; the exact tie policy is an implementation choice to document, not another accepted percentage rule.

### Promotions, free campaigns and gifts

Promo codes target one exact fixed **1/2/5 bundle** and have an end date; selecting that exact quantity through the custom counter also qualifies. Default successful use limit is one per buyer, with configurable dates, buyer allowance and optional global cap. Gifted-order allowance belongs to its buyer, not recipient.

Automatic free campaigns remain in scope with exact fixed bundle, end date, buyer/global controls and optional higher buyer allowance. A zero total requires a valid eligible entered code or automatic authorization; a bare zero from settings is not unlimited free credit. Omit ineligible automatic offers so ordinary paid checkout stays available. Reserve/consume only the actually winning offer; a redundant entered code does not spend allowance.

Reserve held allowance at checkout under the promotion lock, counting held plus consumed use. Consume on verified paid or accepted free settlement. Release only after every relevant payment path is authoritatively closed unpaid; browser closure, local expiry or unknown outcome cannot release it. A consumed use does not reset when a game is unused/restored. Released allowance is not reactivated as a new hold without fresh admission. A matching late already-paid obligation can consume a prior release only with recorded reconciliation evidence; do not hide a quota exception or revoke another customer's accepted use.

A valid free order settles locally once with the separate zero-cost marker/state. It creates no Paymob intention/attempt, fake payment or callback. Bound settlement, consumed allowance and one credit commit together. An unbound free gift waits for verified claim.

Gifts are website purchases. Block recipient matching buyer account or verified phone. Bind an existing verified recipient account at checkout and keep it stable; otherwise bind once on a verified claim/registration. Payment retries/phone changes never look up a different recipient and redirect it. For an unbound/unclaimed gift, Admin may correct the phone after verified buyer request, self-gift/ownership checks and audit; once bound, it cannot be redirected. Valid gifts for other people survive buyer deletion.

**Q87 is accepted:** free allowance counts buyer account **OR** a campaign-local keyed phone fingerprint, counting each usage once. Account recreation on the same phone does not restart that campaign. Capture a keyed HMAC of campaign ID and canonical verified buyer phone for each usage, including paid usage so an edited campaign does not lose history; use stable campaign key version and a secret outside PostgreSQL. Retain the restricted pseudonymous marker until campaign end even after account deletion. Then clear it with a marker under the promotion lock. A cleared campaign cannot be extended/reopened; use a new campaign. This does not identify humans across different phones or create cross-campaign tracking.

## 10. Website and native payments

### Website: Paymob

The website uses Paymob for positive-priced checkout. An order, checkout creation attempt, actual provider transaction, received/verified financial observation and once-only fulfillment are different facts. The simplified design shares some field groups but preserves those distinctions.

- Freeze server-owned intent and price before external checkout. `token_orders.request_digest` preserves the original canonical request even after authorized gift/PII redaction; the same idempotency key with changed intent must conflict.
- Freeze merchant/environment/configuration identity and permitted integrations on an attempt. Secrets and historical key versions live in deployment configuration, not ordinary database JSON.
- External HTTP runs outside database locks. A creation timeout is **unknown**, not proof the provider did nothing. Inquire/reconcile before retrying a possibly accepted creation. A local request key is not a documented provider-side idempotency guarantee.
- Persist real provider intention/order references and transaction IDs in their actual namespace/cardinality. Never match financial evidence merely by phone or customer name.
- Verify the correct Paymob HMAC/notification type or perform an authenticated inquiry. Client/browser success is not proof. Retain sanitized trusted facts and durable processing work before acknowledging accepted intake.
- A processed, correctly mapped successful payment/capture with the exact order, permitted integration, currency and amount may fund once. Pending/authorization, refund and void are not funding.
- Proof/transaction/attempt namespace must agree. Actual transaction identity, original amount/currency/integration and accepted source are immutable. The current projection must reference matching latest processed evidence and verification time; an older success cannot overwrite newer verification.
- An authenticated inquiry closes an attempt only when it **affirmatively confirms final unpaid closure** for that exact attempt/merchant. The FK alone does not prove `confirms_closed_unpaid=true`.
- Bound settlement, consumed applied allowance and one exact order-sourced credit commit together. An unbound paid gift can be settled without a credit until its authorized claim.
- A duplicate delivery or processing retry returns the existing accepted effect. Two real successful transactions are retained as two transactions but fulfill the order once; create an Admin reconciliation case for the extra payment.
- A verified matching late payment honors the original frozen order once, even after local cancellation/expiry, with reconciliation for closed/released-quota exceptions. Wrong amount/currency or deleted beneficiary remains review work, without redirecting funds to another account.
- Later genuine refund/reversal evidence is retained and reconciled. It does not delete the original accepted proof/credit, automatically make the bank negative, restrict the player, or introduce customer cash-out.
- Capture/refund/void parent mappings must correspond to the actual transaction in the same financial context; providers can report cumulative updates or separate action IDs. Verify their enabled API contract rather than inventing one.

Provider API/signature normalization remains an adapter responsibility. A JSON field or SQL enum saying “succeeded” is not itself cryptographic proof. Financial AdminJS records are read-only plus focused audited actions, not editable paid flags.

### Mobile: native store billing

The user clarified that “Apple Pay/Google Pay” meant **Apple In-App Purchase / Google Play Billing**, not merely Paymob card wallets. Latest Q90/Q91 then chose the simpler native scope:

| Channel | Launch purchase scope |
| --- | --- |
| Website | Paymob; presets 1/2/5 and custom 1–20; gifts, codes and automatic free campaigns. |
| iOS | Personal consumable **1/2/5** bundles through Apple In-App Purchase. |
| Android | Personal consumable **1/2/5** bundles through Google Play Billing. |
| Shared account | The same bank/ledger across web and mobile; received website gifts remain usable on mobile. |

Six initial SKU mappings represent one-, two- and five-token products in each store. Native gifting and native offer-authoring were deferred by the user's final simplification. Keep store-managed offer redemption limits separate from website promo quotas if such offers are later introduced; a genuine outside-app redemption still needs recovery/verification.

Aim to match website EGP prices where store price points permit. Store configuration/checkout determines the actual native charge; AdminJS website pricing cannot override it. Local EGP targets are advisory. Historical native money is nullable when a trusted proof omits it: **never invent zero or substitute today's web/store list price**. Native order web-price fields remain NULL under the channel-specific checks.

Native purchase rules:

1. Normal in-app checkout creates the buyer's personal server-owned order for a supported SKU. Treat client success as a claim requiring server verification and account association.
2. Apple financial proof is validated transaction JWS/app/environment/product/quantity/account association. Authenticate notifications appropriately; the funding method is `apple_store_jws`.
3. Google funding requires an authenticated server **Google Play API** result in **PURCHASED** state, mapped to the correct app/product/units/account. Authenticated RTDN/PubSub is a signal to fetch that result, never sufficient funding proof by itself. Pending purchases grant no tokens and are not prematurely completed.
4. Apple identity is the actual transaction within app/environment. Google identity is its globally unique purchase-token hash; encrypt the token with an external key for later API verification/consumption. An optional Google order ID is not the purchase key.
5. Retain unknown/unmapped evidence; an RTDN can arrive before SKU/quantity are known. Unsupported product, multiple-unit/quantity mismatch or app/environment conflicts go to reconciliation, not guessed credit.
6. Preserve existing buyer/order attribution forever. For an otherwise unlinked verified purchase, **Q94 permits the first authenticated valid claimant to bind once to that account's own bank**. A conflicting/deleted previous owner is not an unlinked purchase. Never turn that recovery into gifting or move an old link.
7. Under consistent account/order/source locks, recheck current state and latest proof after external I/O. Commit native settlement, exact source/proof, one matching ledger credit and completion work atomically. Native source/product/channel/buyer/quantity links are composite references.
8. Deliver to the bank before consuming/completing. Google consumption also acknowledges; Apple finishing follows the supported StoreKit/server integration. Persist/retry completion through durable work and client recovery; do not wait for all tokens to be spent. Missing completion must not cause a second credit.
9. Later refund/revocation retains the accepted original credit/proof and opens reconciliation. Current verification cannot rewind; a real later reinstatement can append a fresh observation.
10. Test/live environments remain explicit. Sandbox evidence must not silently fund ordinary production accounts. Recheck official acknowledgement deadlines/SDK details during actual adapter implementation, using original purchase time rather than first local receipt time.

**Canonical proof facts are not globally unique.** A legitimate PURCHASED → REVOKED → PURCHASED sequence can repeat the earlier business facts. v1.2 removed global inquiry/native `facts_hash` uniqueness. Transport notification identity/fingerprint deduplicates deliveries; order/source/ledger uniqueness prevents duplicate fulfillment. Do not restore the removed unique indexes to “improve idempotency.”

## 11. Staff, contact and public content

Keep exactly two fixed staff roles, separate from player/Firebase identities:

| Role | Authority |
| --- | --- |
| `admin` | All operational content, media, categories/packs/questions, prices, promotions, gifts/support, complimentary grants and financial reconciliation/actions. |
| `super_admin` | All Admin operations plus staff-account and staff-role management. |

The earlier `content_admin` policy is superseded by Q89. Do not recreate content-only finance restrictions or a role/permission-management subsystem. The three staff tables are identity, persistent sessions and a relevant action audit.

Complimentary credits require current authorized active staff, matching action/target, a reason and an audit committed with the sourced ledger effect. Generic editing of banks, ledger, proof/settlement fields, frozen order prices and source identities stays disabled. Operational financial authority does not authorize fabricated provider evidence.

Password hashes and opaque session credentials are private. The proposed `staff_sessions` stores a hash of the session identity, bounded serialized middleware state, expiry/revocation and staff reference. Its adapter must match the actual Express/AdminJS serialization; it is not a claim that an unmodified third-party SQL session store uses this table shape. Recheck current role/activity per protected action, revoke on logout/deactivation/password change and bound touch/renewal writes. The starter's eight-hour cookie lifetime is scaffold configuration, not an accepted token or entitlement expiry. Staff MFA/reset/self-service workflows were not added launch scope.

Contact forms are **Support**, **Experience** and **Business/Influencer**. Persist submissions, optional experience rating/comment and open/closed state in an Admin inbox. A supplied email is not verified identity. No email reply integration, threaded tickets or rewards were requested.

Retain the page/branding CMS: localized fixed-schema public pages, media placements, logo/colors/covers/contact/social settings. Validate public media and renderer schemas; staff cannot inject arbitrary executable scripts. Actual legal/public copy and URLs must come from the project, not invented seed data.

Question feedback is host-only Like/Dislike, one current editable vote for each revealed copied question in a game, including retained history. No token reward or required comment. Staff can inspect the exact copied question while retained. Score locking does not stop feedback. **Q85 closes new/edited votes after actual copied-content purge while preserving existing compact votes**; no permanent extra content archive is created for voting.

## 12. Deletion, retention and durable work

### Account deletion: Q75 and accepted Q86

Deletion is deliberate and requires explicit forfeiture consent; it does not make ordinary tokens expire.

1. Leave/end active play first through normal lifecycle/restoration rules. Lock the account and mark deletion pending; block new orders/checkout attempts and new gift/native bindings/claims.
2. Resolve or explicitly review known pending funding: unresolved orders/attempts, mapped queued/review receipts, buyer-bound pending or verified-but-undelivered native purchases, and relevant open financial cases, including native-only cases. A settled outgoing unclaimed gift for another recipient does not by itself block forever.
3. If needed, an authorized Admin records a specific `deletion_funding_review` action/target/reason. Record fresh clearance, then obtain confirmation of the **exact current bank** to forfeit.
4. New mapped financial evidence, a positive credit or permitted attribution to an existing pre-request native intent invalidates clearance and exact consent, returns the request to requested and advances `funding_changed_at`. A review older than that change cannot clear it again. A new unrelated claim remains blocked; previously authorized incoming obligations may still resolve and require new consent.
5. At completion, insert one exact negative forfeiture if the confirmed bank is positive; a zero bank needs no ledger row. Anonymize the profile, remove access and complete the deletion request in the same transaction. The deferred guard rejects a forfeiture committed without completed deletion.
6. Keep tombstone IDs required by financial/history references. A deleted identity cannot be revived and a new account does not regain forfeited tokens/history.

Personal cleanup includes account profile/Firebase mapping under its lifecycle, account-linked lobby/game display names, contact submissions, OTP phone/MAC/provider message, old/new phone-change numbers, applicable bound gift contact/note payloads and sanitized audit details. Revoke reconnect credentials, close owned rooms/invitations, and enqueue external Firebase/auth cleanup. Referenced proof IDs survive redaction; erased payloads cannot be restored by ordinary updates. Preserve other players and valid outgoing gifts. Unbound gifts retain the other recipient locator needed for their explicit claim purpose under the approved privacy policy.

Campaign-local phone markers are the Q87 exception retained until campaign end as already specified; they do not restore deleted accounts or follow a person across different campaigns/phones.

### Copied game content: Q83 and Q85

Full copied question content and media pins remain for **12 months after game end**. Then preserve compact game/result/roster/source question/category/pack IDs, awards, exposure/completion and existing votes. Clear only expired copied payloads/pins; the current catalog remains available and tokens remain permanent.

Record the purge deadline at terminal transition. A bounded worker locks the terminal root game, verifies the actual deadline, removes all its media pins, clears all copied payloads with slot markers and sets the completed root marker atomically. Guards reject early/incomplete purge, post-purge media pins and post-purge vote changes. Concurrent pin insertion serializes against purge. Never reconstruct the old copy from the edited current catalog or leak an alternate archive through action results/outbox payloads.

Physical object collection requires no current catalog, derivative/source, public page/branding or retained-game reference. Archival alone is insufficient. Recheck references and use a configured grace period; external object deletion happens outside locks.

Financial/legal retention durations, OTP/session/receipt TTLs, contact/phone-history lifetimes and operational cleanup schedules still need approved configuration before their corresponding destructive jobs run. No legal duration was invented or silently set to 12 months; that period applies to copied game content specifically. Keep unresolved financial evidence. These configuration inputs do not reopen the settled product questions or expire the token bank.

### Durable work

Reuse `outbox_events` inside the existing API/database topology. Commit source transition and work together. Workers claim bounded rows with `SKIP LOCKED`, commit a lease token/deadline, perform external I/O, then conditionally acknowledge the same lease. Recover expired leases and surface dead work. Routing resource kind/ID is validated topic metadata, not a pretend polymorphic FK.

Use IDs/config versions and bounded sanitized payloads; exclude plaintext credentials, raw purchase tokens, private answers, personal dumps and signed URLs. Topics cover media work/collection, financial verification/completion, auth cleanup and version-change hints. A version hint lets authorized clients resync after gaps/restart; there is no permanent per-socket event log. A SQL outbox does not make unknown external payment effects exactly once.

## 13. All 39 tables and their principal relationships

The table names/order below match the current DBML and [simple table guide](table-guide.md). Exact columns, enums, defaults, checks, index definitions and **all 87 foreign keys** are in the schema inputs; implement those complete definitions rather than inferring them from this summary.

| # | Table | Purpose and main relationship |
| --- | --- | --- |
| 1 | `accounts` | Stable player identity, Egypt phone, Firebase mapping, one active-game pointer and one bank; active pointer binds the account's frozen roster membership. |
| 2 | `phone_verification_challenges` | Purpose/account-bound, expiring one-use OTP proof with MAC/attempts/redaction; no plaintext OTP. |
| 3 | `account_phone_changes` | Successful same-account number change; old/new challenge references or audited support authorization, retaining proof IDs after PII redaction. |
| 4 | `account_deletion_requests` | Same-account funding checkpoint, exact forfeiture consent and completion/cancellation; optional staff review reference. |
| 5 | `categories` | Ordered selectable topics, localized names and archival. |
| 6 | `question_packs` | Category-owned authored six-slot pack, number, content revision and draft/public/archive state. |
| 7 | `questions` | One pack/slot identity with prompt/answer/format/configuration and retirement; replacement retains the retired ID. |
| 8 | `media_assets` | Immutable object metadata/readiness/access scope and optional source lineage; uploading staff reference. |
| 9 | `question_media` | Current question-to-asset role/numbered hint link with applicable stage points. |
| 10 | `rooms` | Reusable host-owned lobby, two team names, current game and current invitation/window. |
| 11 | `room_memberships` | Room participant/account, lobby choices/readiness, reconnect hash, departure/removal and host unblock. |
| 12 | `games` | Accepted round, room/host, two fixed teams/scores, lifecycle/version, active slot, controller and content-retention markers. |
| 13 | `game_packs` | Six saved category columns/pack identities/revisions/names and explicit repeat consent in a game. |
| 14 | `game_questions` | Each saved question: content copy, format/base value, runtime/hints/timer/memory, optional resolution and host feedback. |
| 15 | `game_question_media` | Exact per-game question asset pins, including private originals/answer/hint media. |
| 16 | `game_players` | Frozen starting membership/account/team/name/seat and explicit departure; room/game/member composite references prevent cross-room seats. |
| 17 | `account_question_exposures` | Account/question first exposure and frozen game-member provenance; distinct from completion. |
| 18 | `account_pack_completions` | Account/game/board-column completion; links the same frozen membership and copied pack. |
| 19 | `game_actions` | Accepted command digest/version/outcome with optional append-only score effect; links original host and any awarded question. |
| 20 | `token_ledger_entries` | Uniquely sourced credit, −1 game debit, +1 original-debit restoration or exact deletion forfeiture; INSERT projects bank. |
| 21 | `shop_settings` | Singleton website price/version, gift percentage and small validated tier/fixed-bundle arrays. |
| 22 | `promotions` | Code/automatic campaign, discount, exact bundle, validity, limits and stable campaign fingerprint key version. |
| 23 | `token_orders` | Frozen buyer/request/quantity/channel/beneficiary; web quote/gift fields or native SKU; one immutable accepted source/proof/settlement. |
| 24 | `promo_usages` | Applied campaign/buyer/order hold/consume/release and campaign-local phone marker; composite order identity and key-version links. |
| 25 | `store_products` | Exact app/provider/product-to-1/2/5 mapping, activation/advisory target and editing staff. |
| 26 | `store_purchases` | Actual native identity/token, optional known mapping, stable account/order attribution, verified state/money and post-delivery completion. |
| 27 | `payment_attempts` | Positive Paymob checkout attempt, frozen merchant/config/integrations, correlation and affirmative closure proof. |
| 28 | `payment_provider_references` | Actual Paymob reference-to-attempt/order/merchant namespace mapping. |
| 29 | `payment_transactions` | Actual Paymob transaction/action identity and current verified financial projection, parent relation and latest proof. |
| 30 | `payment_events` | Shared immutable authenticated delivery/financial observations, typed outcome/native state/product/units and processing/mapping; self-link to origin when applicable. |
| 31 | `payment_reconciliation_cases` | Deduplicated financial exceptions with relevant order/attempt/transaction/event/native evidence and audited resolution. |
| 32 | `staff_accounts` | Separate staff email/password hash/activity and fixed Admin/Super Admin role. |
| 33 | `staff_sessions` | Persistent hashed session identity, staff reference, bounded data, expiry/revocation. |
| 34 | `staff_audit_events` | Actor/action/target/request/reason/sanitized evidence; explicit references from sensitive effects. |
| 35 | `contact_submissions` | Three public form kinds, optional authenticated account/rating/contact data and audited close state. |
| 36 | `public_pages` | Fixed localized public renderer content, publish state and editing staff. |
| 37 | `public_page_media` | Public page media positions/alternative text connected to assets. |
| 38 | `site_settings` | Singleton shared branding/public contact/social configuration, logo asset and editing staff. |
| 39 | `outbox_events` | Deduplicated durable topic work with bounded payload, retries, lease ownership/deadline and final state. |

Important relational properties:

- One question belongs to one authored pack; partial unique current `(pack_id, slot_number)` permits retired replacements while preventing two current questions in a slot.
- Games save six distinct categories, ordered columns and question positions; bounds/unique keys establish at most six, not full publication/start completeness.
- There is one active game per room and one active game pointer per signed-in account. Frozen member/host/game/room composite references matter; do not replace them with unrelated scalar IDs.
- Two teams are bounded fields on `games`, not a separate general team/club table.
- Resolution/feedback actor references identify the original host; current caller/controller authorization is a service check.
- Order credits match **order, beneficiary, quantity and accepted settlement kind**, not only order existence. Native source additionally matches order, buyer, SKU, provider/channel and exact verified quantity.
- Game restoration references the original **same account/game/typed debit**, and game/kind uniqueness prevents repeated restoration.
- Payment proof links bind transaction or native purchase; latest verification and attempt closure also link their exact source. These cycles must be handled in migration ordering and short transactions.
- Media references remain relational so retention/garbage collection can prove use.
- Explicit financial/history references generally use `NO ACTION`, preserving tombstones/history instead of cascading financial deletion.
- Audit target kind/key and outbox routing are intentionally generic metadata. Sensitive sources retain actual typed FKs; do not generalize all relations into polymorphic JSON.

The previous 61-table design was consolidated into 37 while retaining every feature, then two native records were added. Do not recreate separate identity, wallet/grant, team, question-runtime/result/vote, invite-registry, permission or per-source-allocation tables from older notes. Small singleton pricing arrays and typed question config/snapshots use bounded JSONB; identifiers, money, balance, state/version and queried links remain typed columns.

## 14. PostgreSQL behavior that must survive application implementation

Load these in order as one complete reviewed schema:

1. PostgreSQL DDL exported from `sahsah.dbml` using pinned `@dbml/cli@10.3.1`.
2. `postgresql-supplement.sql` for **19 partial indexes**.
3. `postgresql-guards.sql` for private helper functions, triggers, projections and immediate/deferred financial/lifecycle checks.

DBML export alone loses required behavior. ORM schema synchronization/generation must not erase custom checks, predicates, referenced unique keys, functions or triggers. The exporter emits FKs as `DEFERRABLE INITIALLY IMMEDIATE` and does not retain every composite-PK display label; deliberate migration naming/deferral is required. Keep the intended immediate/deferred semantics, not just a superficially similar diagram.

v1.2 baseline domain/catalog counts: **39 tables, 37 enums, 87 FKs, 304 CHECKs, 148 indexes** including PK/UNIQUE backing structures and 19 partial indexes. Migration-tool bookkeeping is not a new domain table and should be accounted for separately. Counts are parity checks, not an excuse to preserve a demonstrated bug; explain and update any justified deviation.

Preserve UUID keys, `timestamptz`, exact minor-unit/numeric money, bigint score/version ranges, bytea digests/credential hashes and the current explicit state discriminators. Handle PostgreSQL bigint/numeric safely in TypeScript/JSON. Do not silently coerce large values to imprecise JavaScript numbers. PostgreSQL 18.6 was tested; choose/document the actual application/deployment major rather than assuming native UUIDv7 or another version-specific feature exists everywhere. App-generated IDs/hashes avoid unnecessary extensions.

The guards cover ledger projection/append-only history/source eligibility, immutable order/payment/native attribution, matching current financial proof, explicit unpaid closure, settlement/credit atomicity, native completion after delivery, promotion allowance/history, room admission/removal, sticky game/question history, due complete purge/media pin exclusion, one-way redaction and deletion/funding/forfeiture consistency.

Many checks are **deferred until commit** and read the transaction's final rows. A successful intermediate UPDATE is not acceptance. Roll back/release the connection on statement **or COMMIT** failure. Use real transactions for circular proof/source updates and atomic bound delivery; fixtures must obey the same source contract instead of disabling guards.

Use consistent short lock order. Lobby/start owns room first; ordinary commands own game first and never later acquire room. Lock affected player accounts in sorted ID order before order/attempt/source/promotion changes as applicable; pricing/configuration must be coherently captured. Never acquire a game while already holding arbitrary finance/account locks; stale old-game cleanup runs separately before a new start. The targeted source locks use `FOR NO KEY UPDATE` where sufficient to avoid unnecessarily conflicting with FK key-share locks. Handle deadlock/serialization retries using the same durable request key, without blindly replaying external HTTP.

Financial helpers use `sahsah_internal`, fixed trusted search paths, revoked PUBLIC access and security-definer ownership. Use separate migration ownership and a non-owner runtime role with no DDL/trigger-disable ability or direct helper execution. Grant the actual application narrowly enough to preserve the tested workflows. Trigger depth prevents accidental bank writes; it is not a security boundary against a database owner. Verify real-role permissions as part of migration integration; the old suite ran in an isolated owner-controlled cluster.

Full six-slot publication, all 36 coherent copies, current authority/answer secrecy, actual cryptographic verification, pricing eligibility/winner choice, complete score/progress conservation, lease workers and external retries remain application contracts. SQL functions are focused guards, not the entire game or provider engine. Preserve those boundaries rather than moving all gameplay into stored procedures.

Index strategy:

- Keep required composite FK backing UNIQUE keys even when the leading ID is globally unique.
- v1.2 removed two redundant settlement-source UNIQUE constraints, the extra full current-question index and incorrect global inquiry/native facts uniqueness.
- Sparse maintenance indexes replace full-history alternatives for active claims/games, unpurged content, live invitations/phones, pending/running work, receipt cleanup and mapped proof history; campaign phone lookup supports the accepted allowance policy.
- The active-room/current-slot/current-membership/open-deletion/score-effect unique partial indexes protect real invariants.
- Worker query predicates must imply the exact partial predicate, usually with literal state. Bind cutoffs/IDs; a generic prepared status parameter may prevent that plan. No index predicate uses volatile `now()`.
- One game's board reads at most 36 rows. No speculative JSONB GIN, timer-stage/status index, partitioning or extra cache is introduced. Use deterministic cursor pagination for growing histories and avoid N+1 reads.

## 15. What was actually validated before this handoff

The latest recorded result is [validation/latest-results.json](validation/latest-results.json). Its input hashes were rechecked on 2026-11-04:

| Input | SHA-256 at handoff |
| --- | --- |
| `sahsah.dbml` | `d00486c7abcaee863556b9829e1967a9cb6977511fd865349ac68e6e61b6510c` |
| `postgresql-supplement.sql` | `2e28a4e2823c8f441b29d040d12c2b2f806ae6c1a761b6090ee9f2889a7bb1e4` |
| `postgresql-guards.sql` | `d1378044ec1fd71c0763ae0ac9029ed7f2d5bfdb29eb8a06446f80e6073ab40c` |

The reference suite exported with `@dbml/cli@10.3.1` under Node 24, created its own private Unix-socket PostgreSQL **18.6** instance, loaded all three inputs, ran **68 checks** and stopped/removed its disposable cluster. It accepts no production DSN. Tables/enums/FKs/CHECKs/indexes matched the counts in section 14, and separate structural inspection checked exact FK types/arity/PK-or-UNIQUE targets. The simple guide matched all 39 table names in DBML order.

Six tests used competing PostgreSQL connections:

1. Two starts cannot spend the same account's last token twice.
2. Simultaneous payment handlers cannot double-credit an order.
3. Concurrent free orders cannot oversubscribe the final global campaign slot.
4. Simultaneous guests cannot exceed six people including the host.
5. Deletion serializes against new checkout admission.
6. Content purge serializes against inserting another media pin.

Other checks covered sourced balance projection, direct-write/ledger mutation rejection, frozen order digest, verified Paymob atomic delivery, immutable funding/source/amount, exact integration/namespace, duplicate credit, affirmative closure, source reuse, later reversal preservation, Apple/Google proof families, native completion timing, pending/RTDN rejection, monotonic verification, legitimate reinstatement with recurring facts, removal/unblock and old credential revocation, exact deletion/forfeiture and consent invalidation, fresh staff review, late native attribution, 100% local orders, campaign phone allowance/cleanup, copied-board shape, sticky opening/terminal history, retained votes and complete due purge, and OTP/phone-history redaction.

The pre-audit v1.1 snapshot actually accepted two bad cases: a mapped native notification funding a pending purchase, and an inquiry with no affirmative unpaid confirmation closing checkout. [before-audit-reproductions.json](validation/before-audit-reproductions.json) records that historical source hash/outcome. Current regressions reject both.

The local measurement fixture contained 100,000 jobs (20 pending, 20 running), 10,000 terminal games, 50 additional active games, 50 terminal games awaiting purge and 4,080 additional catalog questions. These were minimal valid rows for access-path measurement, not a complete simulated production game history or media/network workload.

| Index | Full alternative | Sparse v1.2 index |
| --- | ---: | ---: |
| Pending jobs | 4,980,736 bytes | 16,384 bytes |
| Running job leases | 4,997,120 bytes | 16,384 bytes |
| Active-game expiry | 516,096 bytes | 16,384 bytes |
| Content awaiting purge | 425,984 bytes | 16,384 bytes |

The planner chose sparse pending/lease/purge paths. At 50 due active games it preferred the existing active-room uniqueness index plus a small sort over the separate expiry index; that actual plan was retained. Current-slot uniqueness serves the six-current-question query without its removed full index. No forced index scan or universal latency claim was made.

These tests exercised **SQL/reference transactions**, not the starter NestJS API, a selected ORM/migrator, production-role permissions, cryptographic provider adapters, store sandbox transactions, Railway load, backup recovery or end-to-end clients. Your actual migration path and backend integration need their own validation; passing the reference suite is necessary evidence, not proof those new parts work.

Reference command, from repository root, with Node 24, Python 3, `psql` and PostgreSQL 18 binaries available:

```sh
python3 docs/database/validation/validate_design.py --report /tmp/sahsah-design-reference-results.json
```

See [validation/README.md](validation/README.md) for `--pg-bin`. Running as root is unsupported by `initdb`. Keep application dependencies out of this docs runner; use backend-owned tests for the migrated application schema. Do not point test fixtures/destructive setup at an existing database merely because a `DATABASE_URL` happens to be present.

## 16. Detailed source map

Read the relevant sources before implementing that branch. This prompt consolidates decisions; these files preserve complete technical details, primary-source links and historical rationale.

| Topic / trigger | Read |
| --- | --- |
| Current schema or migration parity | [sahsah.dbml](sahsah.dbml), [postgresql-supplement.sql](postgresql-supplement.sql), [postgresql-guards.sql](postgresql-guards.sql), [schema-status.md](schema-status.md) |
| Final decisions / a conflicting old answer | [decisions-summary.md](decisions-summary.md), [design-session.md](design-session.md), [requirements.md](requirements.md), section 18 here |
| Vocabulary | [CONTEXT.md](../../CONTEXT.md); it is a glossary, not a replacement SQL spec |
| Why 61 became 37 then 39 | [schema-simplification-review.md](schema-simplification-review.md), [ADR 0007](../adr/0007-consolidate-launch-schema.md), [ADR 0009](../adr/0009-native-store-purchases.md) |
| Room/game separation | [ADR 0001](../adr/0001-separate-rooms-and-games.md), [identity-invitations.md](identity-invitations.md) |
| Pack edits/replacement/snapshots | [content-editing.md](content-editing.md), [ADR 0002](../adr/0002-editable-packs-and-game-snapshots.md) |
| Group freshness / completion / roster | [pack-freshness.md](pack-freshness.md), [ADR 0003](../adr/0003-group-freshness-and-player-roster.md) |
| Timers/scoring/36th resolution | [gameplay-design.md](gameplay-design.md), current schema/guards for consolidated physical details |
| Expiry/control/lock clocks | [lifecycle-transactions.md](lifecycle-transactions.md), [ADR 0004](../adr/0004-game-expiry-and-token-restoration.md) |
| Token source/projection/restoration | [token-accounting.md](token-accounting.md), [ADR 0006](../adr/0006-one-bank-without-customer-cashout.md), [ADR 0010](../adr/0010-ledger-projection-and-postgresql-integrity.md) |
| Prices/gifts/codes/free orders | [commerce-design.md](commerce-design.md), [zero-cost-orders.md](zero-cost-orders.md), [payment-workflows.md](payment-workflows.md) |
| Paymob adapter/evidence contracts | [commerce-research.md](commerce-research.md), [payment-workflows.md](payment-workflows.md), original Paymob research PDF under `sahsah_designs` |
| Native purchase/claim/completion | [native-store-billing.md](native-store-billing.md), [payment-and-staff-scope-review.md](payment-and-staff-scope-review.md), [ADR 0009](../adr/0009-native-store-purchases.md) |
| Admin authority and staff identity | [ADR 0008](../adr/0008-regular-admin-operational-access.md), [payment-and-staff-scope-review.md](payment-and-staff-scope-review.md), actual backend admin source |
| Ten formats/media/privacy | [content-and-media.md](content-and-media.md), prototype `src/lib/game-types.ts`, `src/lib/game-rules.ts`, `src/demo/party-modes.ts` and prototype docs, with user overrides |
| OTP/phone/invitation/readiness | [identity-invitations.md](identity-invitations.md) |
| Delete/redact/purge/campaign markers/outbox | [operations-and-retention.md](operations-and-retention.md), [postgresql-guards.sql](postgresql-guards.sql) |
| SQL access paths / partial index predicates | [query-plan.md](query-plan.md), [postgresql-notes.md](postgresql-notes.md), [design-quality-review.md](design-quality-review.md) |
| Failure/race traces and test evidence | [scenario-review.md](scenario-review.md), [validation/README.md](validation/README.md), [validation/validate_design.py](validation/validate_design.py), [validation/measure_access_paths.py](validation/measure_access_paths.py), [validation/latest-results.json](validation/latest-results.json) |
| Human table explanation | [table-guide.md](table-guide.md) |
| Dated capacity/cost assumptions | [railway-capacity.md](railway-capacity.md), [single-instance-capacity.md](single-instance-capacity.md) |

Additional historical ADRs: [ADR 0005](../adr/0005-source-backed-token-grants.md) records source-backed grants but its **separate grant-table mechanism** was superseded by consolidation/ADR 0007. The source-backed authorization principle remains on the ledger. `archive/sahsah-v0.9-expanded.dbml` has 61 old tables; `archive/sahsah-v1.0-web-only.dbml` has the 37-table web-only checkpoint. Neither is the implementation target.

External material includes the final quotation and its extracted sources, `system_research.pdf`, `tech_analysis.pdf`, `paymob_architecture_security.pdf` and flowcharts in `sahsah_designs`. Consult them for provenance, not as authority to undo later decisions. For actual SDK/library/provider implementation, verify current primary official documentation and package compatibility; the historical research did not prove the enabled merchant/store contract.

## 17. Implement the database foundation now

These are implementation instructions for the next model, not claims that an ORM, migrator or bootstrap policy was previously selected.

### Step A — inspect and establish the baseline

Read the required sources and actual backend. Inspect Git status and preserve existing work. Confirm source hashes/counts and the applicable Node/package instructions. Summarize the concrete plan briefly, then implement it. The user prefers progress and clear explanations; do not restart the already completed business interview or ask permission for routine reversible local work.

Completion: you can identify the exact three inputs, every affected backend integration point, the existing admin/health behavior, and the proposed migration/test strategy without inferring product rules from archived code.

### Step B — choose the smallest compatible database layer

Reuse an existing database layer if the repository has gained one since this snapshot. Otherwise choose and document a minimal maintained PostgreSQL driver/migration approach. A SQL-first `pg` integration is a straightforward candidate because the design already includes explicit PostgreSQL constraints, triggers and partial indexes; this is a recommendation, **not an earlier user-approved ORM decision**. An ORM is acceptable only if it preserves the full SQL behavior and makes this repository simpler to operate. Do not introduce a workspace/shared package or an adapter simply to create empty CRUD classes for 39 tables.

Use the backend's independent package/lockfile. Provide typed access where used, parameterized queries, explicit bigint/numeric handling and a transaction helper that commits once, handles deferred commit errors, rolls back appropriately and always releases the client. Pool limits/timeouts are bounded configuration; ten connections was an old modeling assumption, not a proven required default or room cap. Integrate shutdown cleanup with Nest lifecycle.

Choose explicit behavior for absent/malformed/unreachable database configuration and readiness, with tests. Preserve existing no-database starter tests or replace their setup deliberately with controlled fixtures. Liveness is not a misleading claim of persistence readiness. Do not silently apply DDL on every API startup.

Completion: the backend owns its pool/configuration/transaction boundary, dependency changes remain isolated, the chosen driver/migrator is documented, and health/admin bootstrap behavior is understood and tested.

### Step C — create versioned application migrations

Export the pinned DBML baseline, preserve all its definitions, then incorporate the partial-index and guard inputs in the required order. Use explicit versioned migrations owned by the backend. Ensure table/type creation and later composite/cyclic FK additions are ordered correctly. Treat helper ownership, search paths and grants as part of the schema.

Provide a repeatable migrate/status workflow with migration tracking and exclusive migration coordination through the chosen maintained tool or a small justified mechanism. Re-running apply must not replay completed migrations; detect changed applied migration content according to the chosen tool's policy. Avoid an unversioned `db push`/synchronization step that drops custom SQL. Gate use of the database until the full baseline, supplement and guards have applied.

Create a practical migration-owner/runtime-role setup or documented provisioning commands using separate credentials. Verify the runtime role can perform intended application transactions and cannot directly change balances, bypass triggers or invoke private helpers. Do not hardcode production users/passwords. Explain local rollback/reset behavior for a disposable database; keep resets explicit and scoped rather than dropping arbitrary existing data.

Completion: a fresh application test database migrated through the actual backend tooling reproduces all 39 domain tables and required enum/FK/check/index/trigger behavior, and a second migration run leaves it intact. Any justified deviation is recorded, not hidden by weakening tests or regenerating away the companion SQL.

### Step D — provide safe setup/reference data

Offer explicit environment examples and commands for migrations, test databases and minimal reference setup. Use base 100 EGP and fixed bundle definitions where applicable; keep unconfirmed discount percentages distinguishable from approved launch data. Do not silently enable a 10% gift campaign because it appears as a proposed SQL default. Require explicit configuration/acknowledgement where a seed would activate an unconfirmed commercial choice.

Do not invent real Apple/Google product identifiers, merchant/integration IDs, Firebase/Meta credentials, customer accounts, paid receipts or 4,000 authored production questions. Synthetic test/dev fixtures remain clearly isolated. Public legal copy/branding and operational retention inputs must be supplied separately. If offering first-staff bootstrap, make it an explicit secret-safe command with correct password hashing, fixed role rules and no checked-in default credential.

Completion: a developer can create a fresh local schema with documented configuration, and no synthetic/test/financial data or unapproved live offer is silently activated.

### Step E — validate the implementation, not only the reference export

Use disposable PostgreSQL to test the **actual migrated application schema and real backend transaction helper/runtime role**. Reuse/adapt the reference cases where useful, while retaining the original reference artifact as a comparison. The docs runner at `docs/database/validation/validate_design.py` exercises the design inputs; separately exercise the backend migrations and transaction code you actually implement.

At minimum verify:

- Fresh migration, repeat apply/status, full expected schema/partial predicates/helpers, and failure handling without partial initialization.
- Ledger projection exactly once, direct balance edit rejection, append-only history, nonnegative spending and rollback/connection release after deferred COMMIT failure.
- Valid sourced Paymob/native/free delivery, duplicate fulfillment rejection, invalid pending/notification proof rejection, affirmative closure and correct current evidence/source identity.
- Native completion after delivery and recurring native financial facts without duplicate credit.
- Removed-account/host-inclusive room capacity, fresh deletion consent/invalidation/exact atomic forfeiture and retained vote/content-purge boundaries.
- The six meaningful concurrent races in section 15, with independent connections, plus any new migration/role/transaction behavior your changes introduce.
- Authorized active staff audit source for complimentary movement, without generic mutable financial resources.
- Existing backend behavior/tests remain valid. If you implement persistent AdminJS login/session integration, additionally exercise authenticated HTTP role boundaries, revocation and session persistence; otherwise record that scaffold limitation explicitly.

Use actual COMMITs in appropriate tests so deferred guards are exercised. Preserve exact-once source semantics when testing duplicate handlers; production retries should recover the stored outcome rather than present a duplicate constraint error as a second successful operation. Fault fixtures must not turn off triggers or use a database-owner shortcut to claim restricted-role behavior.

Run from `web_app/backend/` using its current scripts:

```sh
pnpm check
pnpm test
pnpm build
```

Backend `test` currently builds and runs Node HTTP tests for API/AdminJS. Add appropriate database integration commands/tests without losing that coverage. If frontend changes become necessary, run its `check`/`build`; if prototype/static deployment files change, follow their exact AGENTS checks. This database task should normally leave those applications alone. Do not install/build Flutter.

Completion: tests demonstrate migration parity and real backend connection/transaction behavior, every required applicable check passes, and unexecuted provider/deployment/client work is distinguished from completed schema work. Once the appropriate suite passes, avoid repeatedly broadening tests without a new failure/change or unresolved concern.

### Step F — document and report the delivered increment

Update backend README/environment examples and a focused implementation status with setup, migration, test, reference-data and recovery commands. Keep the domain glossary a glossary. If changing a consequential architectural choice, record its actual trade-off in an ADR; do not invent ADRs for routine syntax decisions.

Report changed files, the chosen database layer/migrator, migration coverage, test evidence and remaining application work. Explain whether AdminJS still uses its scaffold login/memory store or has actual staff persistence; whether accounts/games/commerce are schema-only or exposed through tested services; and whether provider calls were mocked, sandbox-tested or not implemented. Keep claims exact.

Future increments after the schema foundation are staff identity/sessions/resources and publication services, player identity/rooms/game engine/progress, website commerce/provider adapters, native billing integration, media/outbox/retention workers, public/client integration and deployment/load/recovery validation. Preserve the full design while implementing these in reviewable slices. Do not implement a sprawling complete application merely to claim a schema migration is finished.

Completion: the schema foundation is usable and tested in the real backend, all commands and configuration are documented, and a subsequent engineer can resume the next slice without reopening settled decisions.

## 18. Superseded answers and options that must not return accidentally

| Historical answer/proposal | Effective final decision |
| --- | --- |
| Six guests plus a host / seven people | Six total including host. Capacity/fanout arithmetic and reserved host seat reflect six. |
| A room and game treated as the same object | Reusable room, distinct historical/charged game for each accepted replay. |
| Random individual questions or per-user pack-number/content shuffling | Authored fixed six-question packs and group-aware freshness by logical question IDs. |
| Completed packs alone define freshness | Exposure begins at opening, even without completion. Six resolutions in one game define completion separately. |
| Public content immutable or every edit creates a new pack | Public edits after warning; running-game copies remain frozen. Normal edit keeps question ID, explicit replacement gets a new ID. |
| Multiple active games per account / late joining/replacement | One active game per account; fixed starting roster, original reconnect and newcomers next game. |
| Disconnect equals leaving | Disconnect preserves seat/progress eligibility; explicit guest leave stops future credit and releases claim. |
| Host transfer or End game is resumable | Same host only; explicit End/Leave is terminal, app close/disconnect can resume before expiry. |
| Every accepted start keeps its charge even if unopened | Q26 returns one token once on terminal unopened games; after first opening ordinary ending keeps charge. |
| Custom quantity up to 999 | Website whole quantity 1–20. |
| Prototype 10 EGP token price | 100 EGP base; configurable quantity tiers. |
| All discounts never combine | Quantity reduction first; then one winning gift OR promo reduction. |
| Mandatory positive total / always call Paymob | Eligible 100% local order skips provider checkout and grants once. |
| FIFO/free-first/source balances, customer cash refunds and proportional refund allocations | User Q45a excluded customer cash-out/refund feature. One permanent bank; retain source evidence only for authorization/history/exceptions. Q43/Q48 ordinary refund discussions are superseded. |
| Global/request-free welcome grant or account signup resets it | Exact fixed-bundle/date/buyer/global controls plus Q87 campaign-local keyed phone allowance. |
| Archived audio replay cap / timed memory viewing / 30-second answer period | Unlimited audio, manual untimed memory viewing, 60-second answering timer from first hide. |
| Reopening resets the question clock | Preserve progress and remaining time; reset is explicit. |
| Final review/Confirm Finish after question 36 | User selected automatic finish and locked scores on the 36th resolution. |
| Category determines all question formats / prototype admin's five accepted types | Each question owns one of all ten real formats; mixed packs allowed. |
| Both Arabic and Franco mandatory | Arabic required, optional Franco with Arabic fallback. |
| International phone scope | Launch Egypt-only verified WhatsApp numbers. |
| Four-digit invitation | Six numeric characters including leading zeros, separate reconnect credential, 24-hour window. |
| CSV/import/automatic duplicate tools from quotation/research | Manual per-question/media AdminJS authoring only. |
| Earlier Content Admin can only edit content, finance is Super Admin-only | Q89: Admin manages every operation; Super Admin additionally manages staff. Older case/inbox/gift/financial “Super Admin only” wording is superseded too. |
| The assistant's proposed lean deferrals remove CMS, phone changes and automatic campaigns | User chose retain all features; those features remain in the 39-table design. |
| Expanded 61 tables / separate wallet/grant/team/state tables | Consolidated 37-table base, then two required native records = 39 current domain tables. |
| Website-only billing / mobile Apple Pay and Google Pay treated as wallet labels | Native Apple In-App Purchase and Google Play Billing with their own verified purchase identity/completion. |
| Earlier Q90 native all quantities 1–20 | Latest correction: native fixed 1/2/5 only; website custom 1–20 retained. |
| Earlier Q91 native gifting/offer-authoring now | Latest correction: personal native purchases; gifts/promo checkout stay web. Native offer limits remain separately defined if added later. |
| Shared strict promo cap across native stores and website | Native store-managed limits are separate from website promo usages. |
| A verified unmatched native receipt can be credited to any later account | First valid authenticated unlinked claim binds once to its own bank; known owner/order never moves. |
| A notification or mapped proof FK is sufficient funding | Processed eligible financial method, current state, exact namespace/product/units or payment facts and atomic sourced credit are required. |
| Global unique financial facts hash | Financial states can recur; retain observations, deduplicate transport/effects through their actual identities. |
| Both service and trigger update bank | Ledger INSERT trigger is the single balance write owner. |
| Q84–Q87 still awaiting an answer | All four recommendations explicitly accepted on 2026-11-03 and included in v1.2. |
| Earlier “no SQL execution” checkpoints | True for those historical checkpoints; current v1.2 has 68 executed reference checks and synthetic plans, not yet backend/provider/deployment validation. |

## 19. Configuration and technical choices still to supply

There are no unanswered numbered launch product questions. These are remaining implementation/configuration inputs, not permission to fabricate a new business model or block the entire database increment:

| Input | Correct handling |
| --- | --- |
| ORM/driver/migrator | No user selection yet. Make a simple compatible technical choice, preserve custom SQL and document it. |
| Deployed PostgreSQL major | Local validation used 18.6; actual deployment must be explicitly configured/verified. |
| Pool/timeouts/worker batches/retry limits | Choose conservative bounded settings and measure; old pool/CPU/memory assumptions are modeling inputs only. |
| Exact quantity-tier/gift discounts | Base100EGP and tier mechanism are approved; percentages are not. Proposed gift10% is not confirmed launch data. |
| Equal-savings discount tie behavior | Gift-preserving-code is the current technical proposal. Document any implementation choice; do not invent additional stacking. |
| Precise reset-button automatic resume / pack substitution presentation | Existing accepted timer/freshness boundaries stay fixed; these UI interaction details were not finalized and do not block schema foundation. |
| Merchant IDs, enabled Paymob API version/integrations and secrets | Inspect actual merchant contract/config when implementing adapters; use current official documentation, no guessed IDs or idempotency promise. |
| Apple/Google app IDs, actual SKU IDs, console prices and credentials | Supply via configuration. Fixed bundle quantities/own-bank delivery are settled; real IDs/prices must not be invented. |
| Meta WhatsApp/Firebase project configuration | Integration mechanism is designed; credentials/template/provider setup and external failure handling need implementation. |
| Cloudflare product/buckets/upload limits/signing configuration | Bytes belong in Cloudflare and privacy/pins are required; R2 is a researched option, not a provisioned service. |
| OTP/session/receipt/contact TTLs, legal financial retention, collection grace period | Configure before destructive cleanup; 12-month game-copy retention is the one accepted content period, not a blanket financial TTL. |
| Staff bootstrap/password hashing/session adapter | Implement deliberate secure bootstrap and actual middleware compatibility; current env login is scaffold. |
| Public legal text, branding, authored questions/media | Supplied content, not schema-generated production fixtures. |
| Region/SLO/capacity/cost | Actual Egyptian network latency, deployed resources, idle usage and 10/25/50/100-room stages need measurement; test 250/500 only as later conditional steps. No certified 10,000/50,000-user target or guaranteed subsecond SLO was selected from research. |
| Backups/restore and production-role rollout | Document/prove during deployment operations; no earlier recovery drill or production migration was performed. |

Use reasonable technical judgment for routine reversible choices and keep business configuration explicit. Ask the user only when missing information actually blocks the current authorized step or a real product conflict needs resolution; explain the specific conflict/source. Do not repeat already answered questions or ask approval for local inspection, code edits and disposable tests.

The previous design session used grilling/documentation, domain modeling, deep reasoning, research and performance analysis skills. Use relevant skills available in your environment, read their instructions and apply them to the actual stack; using one is not a reason to rerun the 94-question interview. If choosing Drizzle, use its PostgreSQL skill and current primary docs; if staying SQL-first, preserve the explicit SQL contract without adding an ORM only for the skill.

## 20. Complete decision index

This index accounts for every numbered interview question and the two clarifications. The cited section above contains the effective rule; [design-session.md](design-session.md) contains the original chronological record. Q7 was asked early and resolved later; Q40/Q43/Q48/Q90/Q91 have explicit later overrides.

| ID | Topic / final disposition | Section |
| --- | --- | --- |
| Q1 | User/source authority | 2 |
| Q2 | Reusable room versus separately recorded replay | 4, 7 |
| Q3 | AdminJS categories with fixed authored six-question packs | 4, 5 |
| Q4 | One API/primary, six including host, 4k questions/70% images and budget uncertainty | 4 |
| Q5 | Six categories, one pack each, default fresh/unplayed with host selection | 4, 6 |
| Q6 | Published packs included through game tokens | 4 |
| Q7 | Group-fresh pack selection and explicit exhaustion/repeat fallback | 6 |
| Q8 | Six resolutions including no-winner outcomes for completion | 6 |
| Q9 | Pack owns question records; manual duplicate review | 5 |
| Q10 | Opening creates exposure independently of completion | 6 |
| Q11 | Freeze roster; newcomers next game, original reconnect | 6, 7 |
| Q12 | Warning/confirmation allows public edits | 5 |
| Q13 | Existing games keep starting content, new games use edits | 5 |
| Q14 | Edit keeps question identity; replacement gets new identity | 5 |
| Q15 | One active game per signed-in account | 6 |
| Q16 | Signed-in starting roster retains progress through disconnect | 6 |
| Q17 | Preserve completion and flag current replaced pack Updated | 6 |
| Q18 | Explicit guest leave releases account and stops future credit | 6 |
| Q19 | Mid-game guest sign-in starts account progress next game | 6 |
| Q20 | Six within one game; same-game resume, no cross-game partial combination | 6 |
| Q21 | Explicit host leave ends for all; no host transfer | 8 |
| Q22 | 24 elapsed-hour meaningful-gameplay inactivity expiry | 8 |
| Q23 | End is terminal; app closure can resume before expiry | 8 |
| Q24 | Same host can take over device; fence old controller | 8 |
| Q25 | Host pays one; guests/lobby/resume/reconnect/takeover free | 9 |
| Q26 | Terminal unopened game restores once; first opening preserves charge | 9 |
| Q27 | Recover first; audited once-only restoration if unrecoverable | 9 |
| Q28 | Purchased/paid-gift tokens never expire | 9 |
| Q29 | Presets1/2/5; website counter1–20; frozen server price | 9 |
| Q30 | Verified-phone gift claim/binding, never buyer delivery | 9 |
| Q31 | Effective gift OR promo, subsequently layered after quantity discount by Q38 | 9 |
| Q32 | Reasoned audited privileged complimentary credits, not balance overwrite | 9, 11 |
| Q33 | Base100EGP and AdminJS-editable quantity discounts | 9 |
| Q34 | Block gifting to buyer account/verified phone | 9 |
| Q35 | Promo dates/global cap/default one successful use per buyer | 9 |
| Q36 | Separate staff identities and roles from players | 11 |
| Q37 | Same quantity same price through preset/custom, shared tiers | 9 |
| Q38 | Quantity reduction then one winning gift/promo | 9 |
| Q39 | Bind recipient at checkout or first verified claim; no later rerouting | 9 |
| Q40 | Earlier content-only role split superseded by Q89 | 11, 18 |
| Q41 | Up to100% valid discount, local zero order, no negative total | 9 |
| Q42 | Hold promo at checkout, consume settlement, release only final unpaid | 9, 10 |
| Q43 | Ordinary cash-refund discussion superseded by Q45a | 9, 18 |
| Q44 | Retain real provider reversals/shortfall for Admin reconciliation, no negative bank | 10 |
| Q45 | All sources share one permanent bank | 9 |
| Q45a | Explicit no customer cash-out/refund/source allocation | 9, 18 |
| Q46 | Codes target exact fixed bundle and have end date | 9 |
| Q46a | Matching custom quantity qualifies for its fixed-bundle code | 9 |
| Q47 | Granted promotional tokens do not expire | 9 |
| Q48 | Partial cash-refund valuation superseded by no-refund scope | 9, 18 |
| Q49 | Automatic60-second answering clock, host pause/reset | 8 |
| Q50 | Unlimited audio replay | 8 |
| Q51 | Manual untimed memory show/hide/revisit | 8 |
| Q52 | Hint suggestions, host override0..original tile cap | 5, 8 |
| Q53 | First memory hide starts clock; revisit does not restart | 8 |
| Q54 | Back/reopen preserves progress and remaining time | 8 |
| Q55 | Nonnegative absolute total correction records difference | 8 |
| Q56 | Overall correction preserves original awards/category results | 8 |
| Q57 | Scores locked after ending | 8 |
| Q58 | Clock zero does not auto reveal/resolve/award | 8 |
| Q59 | Guests choose teams, host may be neutral, no connected-side minimum | 7, 8 |
| Q60 | Automatic finish on36th resolution, final review declined | 8 |
| Q61 | Question-owned format, mixed packs | 5 |
| Q62 | Arabic required; optional Franco fallback | 5 |
| Q63 | Incomplete drafts, atomic complete playable publication/update | 5 |
| Q64 | All ten prototype formats at launch | 5 |
| Q65 | Three editable positive decreasing hint values with agreed defaults | 5 |
| Q66 | Optional prompt/answer images with reveal control | 5 |
| Q67 | Archive hides new selection, preserves history and pack state | 5 |
| Q68 | Six-digit invitation including leading zeros, QR/share | 7 |
| Q69 | 24-hour issued code/rotation, independent of gameplay/reconnect | 7 |
| Q70 | Immediate name/team/capacity lobby join, no guest OTP/approval queue | 7 |
| Q71 | Saved private guest credential, authenticated account recovery | 7 |
| Q72 | Minimal profile, Egypt-only verified WhatsApp phone | 7 |
| Q73 | Verify old/new for same-account phone change; support if old lost | 7 |
| Q74 | Retained lobby preferences, fresh Ready every replay | 7 |
| Q75 | Leave/end then exact bank-forfeiture consent for deletion | 12 |
| Q76 | Unclaimed gift no expiry; audited correction only while unbound | 9, 11 |
| Q77 | Automatic free campaigns retain bundle/date/buyer/global safeguards | 9 |
| Q78 | Multiple real payments, one order credit, extra-payment case | 10 |
| Q79 | Honor matching late payment once; reconcile exceptions | 10 |
| Q80 | Host-only editable revealed-question Like/Dislike, no rewards/comments required | 11 |
| Q81 | Persistent Support/Experience/Business inbox, no email/ticket integration | 11 |
| Q82 | No CSV; individual question/media creation | 5 |
| Q83 | 12-month copied game content then compact results/IDs/progress | 12 |
| Q84 | Accepted: known removed account blocked until host unblock | 7 |
| Q85 | Accepted: votes retained but edits/new voting close at actual content purge | 11, 12 |
| Q86 | Accepted: pending funding review, fresh exact consent, no new admission during deletion | 12 |
| Q87 | Accepted: campaign-local keyed phone marker until campaign end | 9, 12 |
| Q88 | Native Apple IAP/Google Play Billing alongside website Paymob | 10 |
| Q89 | Admin all operations; Super Admin additionally staff management | 11 |
| Q90 | Latest correction: native fixed1/2/5, web1–20 | 10, 18 |
| Q91 | Latest correction: native personal only; gift/promo checkout stays web | 10, 18 |
| Q92 | Aim native EGP match where store prices allow; actual store price authoritative | 10 |
| Q93 | Native offer limits separate from website-code limits | 10 |
| Q94 | First verified authenticated unlinked native claim binds once to own bank | 10 |

Later unnumbered user decisions also remain binding: retain all features when simplifying61→37; add the two required native records for39; document every decision and explain each table; avoid overengineered staff; apply useful design improvements; and now move from the validated design to actual database implementation using this handoff.

**Start the implementation sequence in section 17 after reading the required files. Deliver working migrations and backend database integration with evidence, and retain the complete application decisions above for subsequent slices.**
