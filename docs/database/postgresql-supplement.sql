-- Proposed companion to sahsah.dbml; review with exported DDL, not a migration.
-- DBML @dbml/cli@10.3.1 does not express these partial index predicates.
-- Validated against disposable PostgreSQL 18 during the v1.2 design audit.

-- Current authored slots; retired questions keep identity/history and can share
-- the former slot with their replacement. Publication still validates all six.
CREATE UNIQUE INDEX questions_one_current_per_pack_slot
  ON questions (pack_id, slot_number)
  WHERE retired_at IS NULL;

CREATE UNIQUE INDEX games_one_active_per_room
  ON games (room_id)
  WHERE status = 'active';

CREATE UNIQUE INDEX room_memberships_one_active_account
  ON room_memberships (room_id, account_id)
  WHERE account_id IS NOT NULL
    AND left_at IS NULL
    AND removed_at IS NULL;

CREATE UNIQUE INDEX account_deletion_requests_one_open_account
  ON account_deletion_requests (account_id)
  WHERE state IN ('requested', 'confirmed');

-- Non-score no-op receipts can share a result version; score effects cannot.
CREATE UNIQUE INDEX game_actions_one_score_effect_per_version
  ON game_actions (game_id, result_version)
  WHERE score_entry_kind IS NOT NULL;

-- Callback/notification transport identities deduplicate exact deliveries in DBML.
-- Financial facts_hash is NOT globally unique: PURCHASED -> REVOKED -> PURCHASED
-- may legitimately return identical facts at a later verification. Source/order
-- uniqueness prevents duplicate token delivery independently of observation count.

-- Sparse host votes; the staff queue explicitly filters feedback_vote IS NOT NULL.
CREATE INDEX game_questions_feedback_recent
  ON game_questions (feedback_vote, feedback_updated_at, game_id)
  WHERE feedback_vote IS NOT NULL;

-- These replace full-table maintenance indexes removed from DBML. Keep explicit
-- literal predicates in worker SQL so PostgreSQL can prove partial-index eligibility.
CREATE INDEX accounts_active_game_release
  ON accounts (active_game_id, id) WHERE active_game_id IS NOT NULL;

CREATE INDEX room_memberships_account_recovery
  ON room_memberships (account_id, room_id) WHERE account_id IS NOT NULL;

CREATE INDEX games_due_expiry
  ON games (idle_expires_at, id) WHERE status = 'active';

CREATE INDEX games_due_content_purge
  ON games (content_purge_after, id)
  WHERE content_purged_at IS NULL AND content_purge_after IS NOT NULL;

CREATE INDEX rooms_expired_code_cleanup
  ON rooms (invitation_expires_at, id) WHERE invitation_code IS NOT NULL;

CREATE INDEX outbox_events_pending_work
  ON outbox_events (available_at, id) WHERE state = 'pending';

CREATE INDEX outbox_events_stale_leases
  ON outbox_events (lease_until, id) WHERE state = 'running';

CREATE INDEX game_actions_receipt_cleanup
  ON game_actions (accepted_at, game_id) WHERE score_entry_kind IS NULL;

CREATE INDEX phone_verification_challenges_phone_history
  ON phone_verification_challenges (phone_e164, created_at, id)
  WHERE phone_e164 IS NOT NULL;

CREATE INDEX payment_events_pending_work
  ON payment_events (state, received_at, id)
  WHERE state IN ('queued', 'needs_review');

CREATE INDEX payment_events_attempt_history
  ON payment_events (attempt_id, verified_at, id) WHERE attempt_id IS NOT NULL;

CREATE INDEX payment_events_native_history
  ON payment_events (native_purchase_id, verified_at, id)
  WHERE native_purchase_id IS NOT NULL;

CREATE INDEX promo_usages_phone_allowance
  ON promo_usages (promotion_id, buyer_phone_fingerprint, state)
  WHERE buyer_phone_fingerprint IS NOT NULL;

-- Row CHECKs/FKs do not establish cross-row counts, current authority, source proof
-- eligibility, score/wallet conservation, immutable transitions or safe retention.
-- Use the documented serialized write paths with restricted generic CRUD access.
-- Exporter-generated DEFERRABLE INITIALLY IMMEDIATE FKs are a review requirement;
-- actual migrations should explicitly choose deferral, defaults and constraint names.
