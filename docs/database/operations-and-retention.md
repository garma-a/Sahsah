# Durable work, administration and retained history

Updated 2026-11-03: Q84–Q87 are accepted and have PostgreSQL guard/reference-test coverage. Production cleanup jobs are not implemented. Configure operational TTLs and approved financial/legal retention before enabling their workers; no durations are invented here.

## Durable work in the existing topology

`outbox_events` supports bounded workers inside the single NestJS service using PostgreSQL, without another Redis/queue deployment. Topics cover game version hints, media processing/cleanup, provider receipt processing/inquiry, external auth work and account cleanup. The source transition and work record commit together.

A worker claims pending work with `SKIP LOCKED`, assigns a lease token/deadline, increments its attempt and commits. It performs I/O outside locks, then applies/acknowledges only if it still owns that lease. Recover expired leases and surface dead work. Topic schemas use small IDs/config versions; never put secrets, answers, signed URLs or unrestricted request payloads in the outbox.

An outbox retry does not make provider HTTP effects exactly once. Unknown payment creation requires inquiry/reconciliation; media uses immutable keys/conditional creation; auth deletion/revocation handlers recheck current local state. Generic resource kind/ID is deliberate routing metadata, not a polymorphic FK: handlers reload and validate their source before acting.

For game fan-out, the committed game/version hint drives a dispatcher that reloads authoritative state and eligible recipients, then pushes the permitted host/viewer projections. Coalesce superseded hints and share bounded projection work instead of requiring a client fetch after every hint. Initial connection/reconnect/version gaps use authorized snapshots from PostgreSQL. This 2026-11-05 API-Q3 refinement is recorded in [ADR 0012](../adr/0012-rest-commands-and-gameplay-push.md). No permanent per-connection message history is needed, and neither WebSocket heartbeat nor countdown tick writes to PostgreSQL.

## Idempotency and authority

Unpaid lobbies belong to rooms. A `games` row represents an accepted started game only, with durable start request UUID/digest, snapshots, claims and exactly one token debit in the same transaction. Rejected starts create no game/debit. Start duplicates check owner/digest and recover that exact game even after ordinary command-receipt cleanup.

`game_actions` binds accepted host commands to their canonical request digest, controller generation and resulting version. Authenticate/fence first; then check duplicate identity before rejecting its old expected version. Same key/new payload conflicts. No-op retries do not renew activity or repeat points/tokens. Receipts store bounded outcomes/IDs, not old private state or bearer credentials; clients resync current authorized state.

Specific once-only sources remain durable independently: question resolution PK, one score award per question, game debit/restoration uniqueness, one order settlement/grant and one deletion-request forfeiture. Controller secret exchanges must recover without placing plaintext credentials in generic receipts.

## Staff, public content and contact

`staff_sessions` is the proposed persistent hashed-cookie store for the authenticated AdminJS middleware. Its adapter serialization must match the actual implementation. Current staff activity/role is checked on every protected action; financial resources are workflow-controlled, not generic CRUD. Deactivation/password reset revokes sessions. Self-service staff MFA/reset and extra roles are not added scope.

`public_pages`, `public_page_media` and `site_settings` represent approved localized content/logo/colors/covers/contact/social configuration, using fixed renderer schemas. Staff do not enter executable scripts or arbitrary page-builder code. Publication validates ready public-scope media; question originals remain private. Actual legal copy/URLs are supplied by the project, not invented by this schema.

`contact_submissions` stores Support, Experience and Business/Influencer forms in a Admin open/closed inbox, with authenticated account linkage only when present. A supplied contact email is not verified identity. Enforce field limits/syntax and abuse controls. No mail sending, response thread or ticket integration is included.

Feedback fields on `game_questions` store one host-only editable Like/Dislike per revealed copied question/game, including retained history, without rewards. It uses separate authority from score commands, so finishing does not itself lock feedback. Q85 keeps existing compact votes but closes new/edited votes when the exact copied content is purged. A terminal score lock alone does not close voting.

Q82 excludes CSV entirely: no import template, job or row-error table is planned. Content questions and their media are created separately in AdminJS.

## Twelve-month game content retention

Q83 retains full copied question content for 12 months after game end, then preserves compact results, original question identities and account progress. Record `content_purge_after` when ending; a bounded worker checks the terminal root game/deadline under lock, removes its media pins, clears copied JSON with per-slot purge markers, and sets the root completed-purge marker in one transaction.

Keep game headers, roster identity/authorized historical access, category/pack/source question IDs, base points, resolutions, score records and personal progress. Do not recreate old question text from the edited catalog or erase historical completion. Timers/runtime contain only small progress metadata, not duplicated answer/media payloads. Idempotency outcomes/outbox hints also exclude answers so they do not become an accidental second content archive.

Collect media bytes only when no current catalog, derivative, public-content or retained-game reference needs them. Catalog archival alone is not permission to delete its assets. Keep an operational grace period and schedule object deletion outside locks; recheck ownership/references before final collection. Current catalog and other games' pins are unaffected by an old game's purge.

Root/slot CHECKs verify marker shape. Companion guards additionally require a due terminal game, complete removal of all copied payloads/media pins with the root marker, no new pins after purge, and no new/edited feedback. Keep prior votes/identity compact; never retain another permanent content copy solely for voting. The worker still owns the documented root-first transaction and reference-safe object collection.

## Account deletion and retained evidence

Q75 requires leaving/ending active play and explicit confirmation of the exact bank forfeited, with no cash refund. `account_deletion_requests` records consent. Under account/wallet locks, recheck the confirmed balance and applicable funding gate; write a unique negative forfeiture only if positive, clear the bank/profile, revoke member/auth access and enqueue external cleanup. Changed balances require reconfirmation. Normal tokens never expire; this is deliberate deletion.

Keep stable tombstone IDs required by payment/ledger references. Anonymization also covers linked personal display names/contact/profile data under the chosen policy; it must not indiscriminately delete shared games, other players' progress or gifts already purchased for other recipients. Fresh account creation does not restore a forfeited bank. Q86 requires resolving or explicitly reviewing known funding before exact consent; Q87 prevents same-phone recreation from resetting a free campaign. Newly received/mapped funding, a credit or permitted native attribution invalidates the prior funding/consent checkpoint.

Financial evidence is separate from a customer cash-out flow. Do not invent a legal retention duration here: choose/configure the approved policy before enabling its automated cleanup, and retain evidence while unresolved reconciliation requires it. Phone-change/support/gift-correction records and contact text have their own personal-data lifecycle; do not leave raw phones in indefinite generic audit dumps.

## PostgreSQL-only integrity and validation

The [supplementary SQL](postgresql-supplement.sql) records partial uniqueness for active game per room, current signed-in membership per room and open deletion request per account. These are additional to DBML export, not applied migrations. Foreign-key deferral and final constraint names must be deliberately chosen in actual migrations.

The [v1.2 runner](validation/README.md) now loads all SQL on disposable PostgreSQL 18.6 and exercises selected positive/rejection cases, simultaneous reference transactions and synthetic plans. Additional API-level start/end/open/claim/payment/deletion and lease-loss cases belong to backend implementation. Run the staged deployed room load profile before asserting capacity. Backups/restore procedures belong to deployment operations and require a tested recovery drill.

Native operations: reuse outbox work for Google consumption/acknowledgement and supported Apple completion after bank credit. Purchase-token hashes preserve duplicate detection; encrypted Google tokens support later verification/completion under the financial retention policy. Notification and verified purchase facts share `payment_events`; native completion never creates a second bank credit. See [native billing](native-store-billing.md).

## Funding review and deletion sequence (Q86)

Lock the account and mark deletion pending after leaving/ending its active game. Block new checkout attempts, new orders and new gift/native claims. Resolve existing pending orders/attempts, verified but undelivered native purchases, queued mapped evidence and open financial cases, or record a specific authorized Admin `deletion_funding_review` audit with reason. A settled outgoing gift awaiting another recipient does not by itself prevent deletion.

Record fresh funding clearance, then ask the player to confirm the exact locked bank. New evidence/binding or positive movement clears both markers and advances `funding_changed_at`; an older staff review cannot clear it again. On completion, insert the exact forfeiture if positive, anonymize the account and complete the request in one transaction. The deferred guard rejects forfeiture without completed deletion. Recheck/commit before acknowledging; an unresolved external provider outcome must never be silently dropped or redirected.

PII cleanup preserves referenced IDs: invalidate and redact OTP phone/MAC/provider-message fields, redact phone-change old/new numbers, clear bound gift contact/note payloads under policy, replace account-associated room/game display names with a nonidentifying label, anonymize linked contact submissions, revoke all room credentials, close owned rooms/codes, and enqueue Firebase/session cleanup. Do not erase other players or reassign their gifts. Unbound gifts need their recipient locator to remain claimable; retain that other recipient's data only for that explicit purpose under the approved policy. Financial audit details must be structured/sanitized and follow their own redaction policy rather than retaining unrestricted personal dumps.

## Campaign-local phone allowance (Q87)

For each website usage, compute a keyed HMAC from promotion ID plus canonical verified buyer phone; the key/version is managed outside PostgreSQL and stays stable for that campaign. This is a restricted pseudonymous marker, not anonymous or a human identity system. Capture it for all usage so editing an offer does not accidentally lose its history; count account OR fingerprint for free allowance under the promotion lock, counting each row once. Native store limits remain separate.

Retain this marker until campaign end, including after deleting an account. Cleanup locks the campaign, clears the fingerprint with a timestamp, and retains nonpersonal financial/usage evidence. Do not extend/reopen a campaign after its markers were cleared; create a new campaign. A new account never recovers forfeited tokens/history, and different phone numbers are not assumed to represent one human.
