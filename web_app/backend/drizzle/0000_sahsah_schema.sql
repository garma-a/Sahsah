CREATE TYPE "public"."account_state" AS ENUM('active', 'deletion_pending', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."applied_discount_kind" AS ENUM('none', 'gift', 'promo_code');--> statement-breakpoint
CREATE TYPE "public"."contact_kind" AS ENUM('support', 'experience', 'business');--> statement-breakpoint
CREATE TYPE "public"."contact_state" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TYPE "public"."deletion_request_state" AS ENUM('requested', 'confirmed', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."feedback_vote" AS ENUM('like', 'dislike');--> statement-breakpoint
CREATE TYPE "public"."game_end_reason" AS ENUM('completed', 'host_ended', 'host_left', 'idle_timeout', 'platform_failure');--> statement-breakpoint
CREATE TYPE "public"."game_restoration_reason" AS ENUM('unopened_game', 'platform_failure');--> statement-breakpoint
CREATE TYPE "public"."game_status" AS ENUM('active', 'finished', 'expired', 'failed');--> statement-breakpoint
CREATE TYPE "public"."media_access_scope" AS ENUM('private', 'public');--> statement-breakpoint
CREATE TYPE "public"."media_asset_state" AS ENUM('pending', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."media_kind" AS ENUM('image', 'audio');--> statement-breakpoint
CREATE TYPE "public"."order_payment_state" AS ENUM('pending', 'paid', 'not_required', 'store_verified', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."pack_publication_state" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TYPE "public"."payment_attempt_state" AS ENUM('initializing', 'ready', 'unknown', 'closed_unpaid', 'paid');--> statement-breakpoint
CREATE TYPE "public"."payment_environment" AS ENUM('test', 'live');--> statement-breakpoint
CREATE TYPE "public"."payment_outcome" AS ENUM('pending', 'authorized', 'succeeded', 'failed', 'voided');--> statement-breakpoint
CREATE TYPE "public"."payment_receipt_state" AS ENUM('queued', 'processed', 'needs_review', 'ignored');--> statement-breakpoint
CREATE TYPE "public"."payment_transaction_kind" AS ENUM('payment', 'capture', 'refund', 'void');--> statement-breakpoint
CREATE TYPE "public"."payment_verification_method" AS ENUM('hmac_callback', 'authenticated_inquiry', 'apple_store_jws', 'apple_store_notification', 'google_play_api', 'google_play_rtdn');--> statement-breakpoint
CREATE TYPE "public"."phone_verification_purpose" AS ENUM('sign_in', 'phone_change_old', 'phone_change_new');--> statement-breakpoint
CREATE TYPE "public"."player_locale" AS ENUM('ar', 'franco');--> statement-breakpoint
CREATE TYPE "public"."promo_usage_state" AS ENUM('held', 'consumed', 'released');--> statement-breakpoint
CREATE TYPE "public"."promotion_trigger" AS ENUM('code', 'automatic_free');--> statement-breakpoint
CREATE TYPE "public"."provider_reference_kind" AS ENUM('intention', 'order');--> statement-breakpoint
CREATE TYPE "public"."question_format" AS ENUM('STANDARD', 'IMAGE_BLUR', 'IMAGE_ZOOM', 'AUDIO_GUESS', 'AUDIO_REVERSE', 'IMAGE_PERSON', 'IMAGE_COLOR', 'IMAGE_RIDDLE', 'AUDIO_VOICE', 'IMAGE_MEMORY');--> statement-breakpoint
CREATE TYPE "public"."question_media_role" AS ENUM('prompt_image', 'answer_image', 'source_image', 'question_audio', 'source_audio', 'answer_audio', 'hint_image');--> statement-breakpoint
CREATE TYPE "public"."question_timer_state" AS ENUM('ready', 'running', 'paused', 'elapsed');--> statement-breakpoint
CREATE TYPE "public"."reconciliation_state" AS ENUM('open', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."score_entry_kind" AS ENUM('question_award', 'manual_adjustment');--> statement-breakpoint
CREATE TYPE "public"."settlement_kind" AS ENUM('payment', 'zero_cost', 'native_store');--> statement-breakpoint
CREATE TYPE "public"."staff_role" AS ENUM('super_admin', 'admin');--> statement-breakpoint
CREATE TYPE "public"."store_completion_state" AS ENUM('not_required', 'pending', 'completed');--> statement-breakpoint
CREATE TYPE "public"."store_purchase_state" AS ENUM('pending', 'purchased', 'cancelled', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."token_entry_kind" AS ENUM('credit', 'game_debit', 'game_restoration', 'deletion_forfeiture');--> statement-breakpoint
CREATE TYPE "public"."token_order_kind" AS ENUM('personal', 'gift');--> statement-breakpoint
CREATE TYPE "public"."work_state" AS ENUM('pending', 'running', 'succeeded', 'dead');--> statement-breakpoint
CREATE TABLE "account_deletion_requests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"request_key" uuid NOT NULL,
	"state" "deletion_request_state" DEFAULT 'requested' NOT NULL,
	"confirmed_bank" integer,
	"requested_at" timestamp with time zone NOT NULL,
	"funding_cleared_at" timestamp with time zone,
	"funding_changed_at" timestamp with time zone,
	"funding_review_audit_event_id" uuid,
	"confirmed_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	CONSTRAINT "account_deletion_requests_request_key_unique" UNIQUE("request_key"),
	CONSTRAINT "account_deletion_requests_funding_change_order" CHECK (funding_changed_at IS NULL OR funding_changed_at >= requested_at),
	CONSTRAINT "account_deletion_requests_fresh_clearance" CHECK (funding_cleared_at IS NULL OR funding_cleared_at >= coalesce(funding_changed_at, requested_at)),
	CONSTRAINT "account_deletion_requests_cleared_confirmation" CHECK (confirmed_at IS NULL OR (funding_cleared_at IS NOT NULL AND confirmed_at >= funding_cleared_at)),
	CONSTRAINT "account_deletion_requests_clearance_order" CHECK (funding_cleared_at IS NULL OR funding_cleared_at >= requested_at),
	CONSTRAINT "account_deletion_requests_confirmation_pair" CHECK ((confirmed_bank IS NULL) = (confirmed_at IS NULL)),
	CONSTRAINT "account_deletion_requests_bank_bounds" CHECK (confirmed_bank IS NULL OR confirmed_bank >= 0),
	CONSTRAINT "account_deletion_requests_confirmation_required" CHECK (state NOT IN ('confirmed', 'completed') OR confirmed_at IS NOT NULL),
	CONSTRAINT "account_deletion_requests_completion_pair" CHECK ((state = 'completed') = (completed_at IS NOT NULL)),
	CONSTRAINT "account_deletion_requests_cancellation_pair" CHECK ((state = 'cancelled') = (cancelled_at IS NOT NULL)),
	CONSTRAINT "account_deletion_requests_confirmation_order" CHECK (confirmed_at IS NULL OR confirmed_at >= requested_at),
	CONSTRAINT "account_deletion_requests_completion_order" CHECK (completed_at IS NULL OR (confirmed_at IS NOT NULL AND completed_at >= confirmed_at)),
	CONSTRAINT "account_deletion_requests_cancellation_order" CHECK (cancelled_at IS NULL OR cancelled_at >= requested_at)
);
--> statement-breakpoint
CREATE TABLE "account_phone_changes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"old_phone_e164" text,
	"new_phone_e164" text,
	"old_phone_challenge_id" uuid,
	"new_phone_challenge_id" uuid NOT NULL,
	"support_audit_event_id" uuid,
	"changed_at" timestamp with time zone NOT NULL,
	"redacted_at" timestamp with time zone,
	CONSTRAINT "account_phone_changes_old_phone_challenge_id_unique" UNIQUE("old_phone_challenge_id"),
	CONSTRAINT "account_phone_changes_new_phone_challenge_id_unique" UNIQUE("new_phone_challenge_id"),
	CONSTRAINT "account_phone_changes_support_audit_event_id_unique" UNIQUE("support_audit_event_id"),
	CONSTRAINT "account_phone_changes_redaction_order" CHECK (redacted_at IS NULL OR redacted_at >= changed_at),
	CONSTRAINT "account_phone_changes_redaction_shape" CHECK ((redacted_at IS NULL AND old_phone_e164 IS NOT NULL AND new_phone_e164 IS NOT NULL) OR (redacted_at IS NOT NULL AND old_phone_e164 IS NULL AND new_phone_e164 IS NULL)),
	CONSTRAINT "account_phone_changes_different_numbers" CHECK (old_phone_e164 <> new_phone_e164),
	CONSTRAINT "account_phone_changes_distinct_proofs" CHECK (old_phone_challenge_id <> new_phone_challenge_id),
	CONSTRAINT "account_phone_changes_authorization_source" CHECK ((old_phone_challenge_id IS NOT NULL) <> (support_audit_event_id IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"state" "account_state" DEFAULT 'active' NOT NULL,
	"display_name" text,
	"phone_e164" text,
	"phone_verified_at" timestamp with time zone,
	"preferred_locale" "player_locale" DEFAULT 'ar' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"firebase_project_id" text,
	"firebase_uid" text,
	"active_game_id" uuid,
	"active_game_claimed_at" timestamp with time zone,
	"token_balance" integer DEFAULT 0 NOT NULL,
	"token_balance_updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_phone_e164_unique" UNIQUE("phone_e164"),
	CONSTRAINT "accounts_verified_phone_pair" CHECK ((phone_e164 IS NULL) = (phone_verified_at IS NULL)),
	CONSTRAINT "accounts_egypt_e164_shape" CHECK (phone_e164 IS NULL OR (phone_e164 ~ '^\+[1-9][0-9]{7,14}$' AND left(phone_e164, 3) = '+20')),
	CONSTRAINT "accounts_live_profile_required" CHECK (state = 'deleted' OR (display_name IS NOT NULL AND length(btrim(display_name)) > 0 AND phone_e164 IS NOT NULL)),
	CONSTRAINT "accounts_deleted_time_pair" CHECK ((state = 'deleted') = (deleted_at IS NOT NULL)),
	CONSTRAINT "accounts_deleted_profile_cleared" CHECK (state <> 'deleted' OR (display_name IS NULL AND phone_e164 IS NULL AND phone_verified_at IS NULL)),
	CONSTRAINT "accounts_deletion_order" CHECK (deleted_at IS NULL OR deleted_at >= created_at),
	CONSTRAINT "accounts_firebase_pair" CHECK ((firebase_project_id IS NULL) = (firebase_uid IS NULL)),
	CONSTRAINT "accounts_firebase_nonblank" CHECK (firebase_uid IS NULL OR (length(btrim(firebase_uid)) > 0 AND length(btrim(firebase_project_id)) > 0)),
	CONSTRAINT "accounts_active_claim_pair" CHECK ((active_game_id IS NULL) = (active_game_claimed_at IS NULL)),
	CONSTRAINT "accounts_active_claim_state" CHECK (active_game_id IS NULL OR state = 'active'),
	CONSTRAINT "accounts_nonnegative_bank" CHECK (token_balance >= 0),
	CONSTRAINT "accounts_deleted_bank_released" CHECK (state <> 'deleted' OR (token_balance = 0 AND active_game_id IS NULL))
);
--> statement-breakpoint
CREATE TABLE "phone_verification_challenges" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid,
	"phone_e164" text,
	"purpose" "phone_verification_purpose" NOT NULL,
	"otp_mac" "bytea",
	"mac_key_version" smallint NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"max_attempts" smallint DEFAULT 5 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"provider_message_id" text,
	"sent_at" timestamp with time zone,
	"verified_at" timestamp with time zone,
	"consumed_at" timestamp with time zone,
	"invalidated_at" timestamp with time zone,
	"redacted_at" timestamp with time zone,
	CONSTRAINT "phone_verification_challenges_fresh_consumption" CHECK (consumed_at IS NULL OR consumed_at < expires_at),
	CONSTRAINT "phone_verification_challenges_redaction_order" CHECK (redacted_at IS NULL OR redacted_at >= created_at),
	CONSTRAINT "phone_verification_challenges_redaction_shape" CHECK ((redacted_at IS NULL AND phone_e164 IS NOT NULL AND otp_mac IS NOT NULL) OR (redacted_at IS NOT NULL AND phone_e164 IS NULL AND otp_mac IS NULL AND provider_message_id IS NULL)),
	CONSTRAINT "phone_verification_challenges_egypt_shape" CHECK (phone_e164 IS NULL OR (phone_e164 ~ '^\+[1-9][0-9]{7,14}$' AND left(phone_e164, 3) = '+20')),
	CONSTRAINT "phone_verification_challenges_change_owner" CHECK (purpose = 'sign_in' OR account_id IS NOT NULL),
	CONSTRAINT "phone_verification_challenges_mac_shape" CHECK ((otp_mac IS NULL OR octet_length(otp_mac) = 32) AND mac_key_version > 0),
	CONSTRAINT "phone_verification_challenges_attempt_bounds" CHECK (max_attempts > 0 AND attempts BETWEEN 0 AND max_attempts),
	CONSTRAINT "phone_verification_challenges_expiry_order" CHECK (expires_at > created_at),
	CONSTRAINT "phone_verification_challenges_send_order" CHECK (sent_at IS NULL OR sent_at >= created_at),
	CONSTRAINT "phone_verification_challenges_verification_window" CHECK (verified_at IS NULL OR (verified_at >= created_at AND verified_at < expires_at)),
	CONSTRAINT "phone_verification_challenges_consumption_order" CHECK (consumed_at IS NULL OR (verified_at IS NOT NULL AND consumed_at >= verified_at)),
	CONSTRAINT "phone_verification_challenges_invalidation_order" CHECK (invalidated_at IS NULL OR invalidated_at >= created_at)
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name_ar" text NOT NULL,
	"name_franco" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "categories_display_order_bounds" CHECK (display_order >= 0)
);
--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"media_kind" "media_kind" NOT NULL,
	"state" "media_asset_state" DEFAULT 'pending' NOT NULL,
	"access_scope" "media_access_scope" DEFAULT 'private' NOT NULL,
	"storage_provider" text NOT NULL,
	"storage_namespace" text NOT NULL,
	"storage_key" text NOT NULL,
	"content_type" text,
	"byte_size" bigint,
	"width_px" integer,
	"height_px" integer,
	"duration_ms" integer,
	"sha256" "bytea",
	"source_asset_id" uuid,
	"transform_spec" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"uploaded_by_staff_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ready_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	CONSTRAINT "media_assets_provider_bounds" CHECK (length(btrim(storage_provider)) > 0 AND octet_length(storage_provider) <= 32),
	CONSTRAINT "media_assets_namespace_bounds" CHECK (length(btrim(storage_namespace)) > 0 AND octet_length(storage_namespace) <= 128),
	CONSTRAINT "media_assets_key_bounds" CHECK (length(btrim(storage_key)) > 0 AND octet_length(storage_key) <= 1024),
	CONSTRAINT "media_assets_ready_time_pair" CHECK ((state = 'ready') = (ready_at IS NOT NULL)),
	CONSTRAINT "media_assets_ready_order" CHECK (ready_at IS NULL OR ready_at >= created_at),
	CONSTRAINT "media_assets_positive_bytes" CHECK (byte_size IS NULL OR byte_size > 0),
	CONSTRAINT "media_assets_dimension_pair" CHECK ((width_px IS NULL) = (height_px IS NULL)),
	CONSTRAINT "media_assets_positive_dimensions" CHECK (width_px IS NULL OR (width_px > 0 AND height_px > 0)),
	CONSTRAINT "media_assets_positive_duration" CHECK (duration_ms IS NULL OR duration_ms > 0),
	CONSTRAINT "media_assets_checksum_shape" CHECK (sha256 IS NULL OR octet_length(sha256) = 32),
	CONSTRAINT "media_assets_no_direct_self_source" CHECK (source_asset_id IS NULL OR source_asset_id <> id),
	CONSTRAINT "media_assets_transform_object" CHECK (jsonb_typeof(transform_spec) = 'object'),
	CONSTRAINT "media_assets_ready_metadata" CHECK (state <> 'ready' OR (content_type IS NOT NULL AND byte_size IS NOT NULL AND ((media_kind = 'image' AND left(content_type, 6) = 'image/' AND width_px IS NOT NULL AND height_px IS NOT NULL AND duration_ms IS NULL) OR (media_kind = 'audio' AND left(content_type, 6) = 'audio/' AND duration_ms IS NOT NULL AND width_px IS NULL AND height_px IS NULL))))
);
--> statement-breakpoint
CREATE TABLE "question_media" (
	"question_id" uuid NOT NULL,
	"media_role" "question_media_role" NOT NULL,
	"variant_number" smallint DEFAULT 0 NOT NULL,
	"suggested_points" smallint,
	"media_asset_id" uuid NOT NULL,
	CONSTRAINT "question_media_pkey" PRIMARY KEY("question_id","media_role","variant_number"),
	CONSTRAINT "question_media_variant_shape" CHECK ((media_role = 'hint_image' AND variant_number BETWEEN 0 AND 2 AND suggested_points IS NOT NULL AND suggested_points BETWEEN 1 AND 600) OR (media_role <> 'hint_image' AND variant_number = 0 AND suggested_points IS NULL))
);
--> statement-breakpoint
CREATE TABLE "question_packs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"category_id" uuid NOT NULL,
	"pack_number" integer NOT NULL,
	"content_revision" bigint DEFAULT 1 NOT NULL,
	"publication_state" "pack_publication_state" DEFAULT 'draft' NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "question_packs_positive_number_revision" CHECK (pack_number > 0 AND content_revision > 0),
	CONSTRAINT "question_packs_update_order" CHECK (updated_at >= created_at)
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"pack_id" uuid NOT NULL,
	"slot_number" smallint NOT NULL,
	"prompt_ar" text NOT NULL,
	"prompt_franco" text,
	"answer_ar" text NOT NULL,
	"answer_franco" text,
	"format" "question_format" NOT NULL,
	"format_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"retired_at" timestamp with time zone,
	CONSTRAINT "questions_format_config_object" CHECK (jsonb_typeof(format_config) = 'object'),
	CONSTRAINT "questions_slot_bounds" CHECK (slot_number BETWEEN 1 AND 6)
);
--> statement-breakpoint
CREATE TABLE "room_memberships" (
	"id" uuid PRIMARY KEY NOT NULL,
	"room_id" uuid NOT NULL,
	"account_id" uuid,
	"display_name" text NOT NULL,
	"lobby_team_number" smallint,
	"ready_for_generation" integer,
	"ready_at" timestamp with time zone,
	"joined_at" timestamp with time zone NOT NULL,
	"left_at" timestamp with time zone,
	"removed_at" timestamp with time zone,
	"removal_lifted_at" timestamp with time zone,
	"removal_lifted_by_account_id" uuid,
	"reconnect_credential_hash" "bytea",
	"reconnect_issued_at" timestamp with time zone,
	"reconnect_revoked_at" timestamp with time zone,
	CONSTRAINT "room_memberships_reconnect_credential_hash_unique" UNIQUE("reconnect_credential_hash"),
	CONSTRAINT "room_memberships_inactive_credential_revoked" CHECK ((left_at IS NULL AND removed_at IS NULL) OR reconnect_credential_hash IS NULL OR reconnect_revoked_at IS NOT NULL),
	CONSTRAINT "room_memberships_unblock_order" CHECK (removal_lifted_at IS NULL OR (removed_at IS NOT NULL AND removal_lifted_at >= removed_at)),
	CONSTRAINT "room_memberships_unblock_pair" CHECK ((removal_lifted_at IS NULL) = (removal_lifted_by_account_id IS NULL)),
	CONSTRAINT "room_memberships_nonblank_name" CHECK (length(btrim(display_name)) > 0),
	CONSTRAINT "room_memberships_team_bounds" CHECK (lobby_team_number IS NULL OR lobby_team_number IN (1, 2)),
	CONSTRAINT "room_memberships_ready_pair" CHECK ((ready_for_generation IS NULL) = (ready_at IS NULL)),
	CONSTRAINT "room_memberships_ready_generation" CHECK (ready_for_generation IS NULL OR ready_for_generation > 0),
	CONSTRAINT "room_memberships_ready_order" CHECK (ready_at IS NULL OR ready_at >= joined_at),
	CONSTRAINT "room_memberships_leave_order" CHECK (left_at IS NULL OR left_at >= joined_at),
	CONSTRAINT "room_memberships_removal_order" CHECK (removed_at IS NULL OR removed_at >= joined_at),
	CONSTRAINT "room_memberships_credential_pair" CHECK ((reconnect_credential_hash IS NULL) = (reconnect_issued_at IS NULL)),
	CONSTRAINT "room_memberships_credential_hash" CHECK (reconnect_credential_hash IS NULL OR octet_length(reconnect_credential_hash) = 32),
	CONSTRAINT "room_memberships_credential_revocation" CHECK (reconnect_revoked_at IS NULL OR (reconnect_issued_at IS NOT NULL AND reconnect_revoked_at >= reconnect_issued_at))
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_account_id" uuid NOT NULL,
	"current_game_id" uuid,
	"lobby_generation" integer DEFAULT 1 NOT NULL,
	"team_one_name" text NOT NULL,
	"team_two_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"invitation_code" char(6),
	"invitation_issued_at" timestamp with time zone,
	"invitation_expires_at" timestamp with time zone,
	"invitation_revoked_at" timestamp with time zone,
	CONSTRAINT "rooms_invitation_code_unique" UNIQUE("invitation_code"),
	CONSTRAINT "rooms_positive_lobby_generation" CHECK (lobby_generation > 0),
	CONSTRAINT "rooms_nonblank_team_names" CHECK (length(btrim(team_one_name)) > 0 AND length(btrim(team_two_name)) > 0),
	CONSTRAINT "rooms_close_order" CHECK (closed_at IS NULL OR closed_at >= created_at),
	CONSTRAINT "rooms_invitation_presence" CHECK ((invitation_code IS NULL) = (invitation_issued_at IS NULL) AND (invitation_code IS NULL) = (invitation_expires_at IS NULL)),
	CONSTRAINT "rooms_six_digit_code" CHECK (invitation_code IS NULL OR invitation_code ~ '^[0-9]{6}$'),
	CONSTRAINT "rooms_invitation_lifetime" CHECK (invitation_expires_at IS NULL OR invitation_expires_at = invitation_issued_at + interval '24 hours'),
	CONSTRAINT "rooms_invitation_revocation" CHECK (invitation_revoked_at IS NULL OR (invitation_code IS NOT NULL AND invitation_revoked_at >= invitation_issued_at))
);
--> statement-breakpoint
CREATE TABLE "game_actions" (
	"game_id" uuid NOT NULL,
	"command_id" uuid NOT NULL,
	"host_account_id" uuid NOT NULL,
	"command_name" varchar(64) NOT NULL,
	"request_digest" "bytea" NOT NULL,
	"controller_generation" bigint NOT NULL,
	"expected_version" bigint NOT NULL,
	"result_version" bigint NOT NULL,
	"result_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"accepted_at" timestamp with time zone NOT NULL,
	"score_entry_kind" "score_entry_kind",
	"score_team_number" smallint,
	"score_delta" bigint,
	"score_total_before" bigint,
	"score_total_after" bigint,
	"score_source_board_position" smallint,
	"score_source_question_position" smallint,
	CONSTRAINT "game_actions_pkey" PRIMARY KEY("game_id","command_id"),
	CONSTRAINT "game_actions_request_shape" CHECK (octet_length(request_digest) = 32 AND length(btrim(command_name)) > 0),
	CONSTRAINT "game_actions_version_bounds" CHECK (controller_generation > 0 AND expected_version >= 0),
	CONSTRAINT "game_actions_result_version" CHECK (result_version BETWEEN expected_version AND expected_version + 1),
	CONSTRAINT "game_actions_result_object" CHECK (jsonb_typeof(result_data) = 'object'),
	CONSTRAINT "game_actions_score_presence" CHECK ((score_entry_kind IS NULL AND score_team_number IS NULL AND score_delta IS NULL AND score_total_before IS NULL AND score_total_after IS NULL AND score_source_board_position IS NULL AND score_source_question_position IS NULL) OR (score_entry_kind IS NOT NULL AND score_team_number IS NOT NULL AND score_delta IS NOT NULL AND score_total_before IS NOT NULL AND score_total_after IS NOT NULL)),
	CONSTRAINT "game_actions_team_bounds" CHECK (score_team_number IS NULL OR score_team_number IN (1, 2)),
	CONSTRAINT "game_actions_score_difference" CHECK (score_entry_kind IS NULL OR (score_total_before >= 0 AND score_total_after >= 0 AND score_delta = score_total_after - score_total_before AND result_version = expected_version + 1)),
	CONSTRAINT "game_actions_score_source_pair" CHECK ((score_source_board_position IS NULL) = (score_source_question_position IS NULL)),
	CONSTRAINT "game_actions_score_kind" CHECK (score_entry_kind IS NULL OR (score_entry_kind = 'question_award' AND score_source_board_position IS NOT NULL AND score_delta BETWEEN 0 AND 600) OR (score_entry_kind = 'manual_adjustment' AND score_source_board_position IS NULL AND score_delta <> 0))
);
--> statement-breakpoint
CREATE TABLE "game_packs" (
	"game_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"pack_id" uuid NOT NULL,
	"board_position" smallint NOT NULL,
	"pack_number" integer NOT NULL,
	"source_content_revision" bigint NOT NULL,
	"category_name_ar" text NOT NULL,
	"category_name_franco" text,
	"repeat_accepted_at" timestamp with time zone,
	"repeat_accepted_by_seat" smallint,
	CONSTRAINT "game_packs_pkey" PRIMARY KEY("game_id","board_position"),
	CONSTRAINT "game_packs_position_bounds" CHECK (board_position BETWEEN 1 AND 6),
	CONSTRAINT "game_packs_source_revision_bounds" CHECK (pack_number > 0 AND source_content_revision > 0),
	CONSTRAINT "game_packs_repeat_consent_pair" CHECK ((repeat_accepted_at IS NULL) = (repeat_accepted_by_seat IS NULL))
);
--> statement-breakpoint
CREATE TABLE "game_players" (
	"game_id" uuid NOT NULL,
	"room_id" uuid NOT NULL,
	"room_member_id" uuid NOT NULL,
	"seat_number" smallint NOT NULL,
	"account_id" uuid,
	"team_number" smallint,
	"display_name" text NOT NULL,
	"joined_at" timestamp with time zone NOT NULL,
	"left_at" timestamp with time zone,
	CONSTRAINT "game_players_pkey" PRIMARY KEY("game_id","seat_number"),
	CONSTRAINT "game_players_seat_bounds" CHECK (seat_number BETWEEN 1 AND 6),
	CONSTRAINT "game_players_departure_order" CHECK (left_at IS NULL OR left_at >= joined_at),
	CONSTRAINT "game_players_team_bounds" CHECK (team_number IS NULL OR team_number IN (1, 2))
);
--> statement-breakpoint
CREATE TABLE "game_question_media" (
	"game_id" uuid NOT NULL,
	"board_position" smallint NOT NULL,
	"question_position" smallint NOT NULL,
	"media_role" "question_media_role" NOT NULL,
	"variant_number" smallint DEFAULT 0 NOT NULL,
	"media_asset_id" uuid NOT NULL,
	CONSTRAINT "game_question_media_pkey" PRIMARY KEY("game_id","board_position","question_position","media_role","variant_number"),
	CONSTRAINT "game_question_media_variant_role" CHECK ((media_role = 'hint_image' AND variant_number BETWEEN 0 AND 2) OR (media_role <> 'hint_image' AND variant_number = 0))
);
--> statement-breakpoint
CREATE TABLE "game_questions" (
	"game_id" uuid NOT NULL,
	"board_position" smallint NOT NULL,
	"question_position" smallint NOT NULL,
	"source_question_id" uuid NOT NULL,
	"base_points" smallint NOT NULL,
	"format" "question_format" NOT NULL,
	"snapshot_schema_version" smallint DEFAULT 1 NOT NULL,
	"content_snapshot" jsonb,
	"content_purged_at" timestamp with time zone,
	"first_opened_at" timestamp with time zone,
	"revealed_at" timestamp with time zone,
	"stage_index" smallint DEFAULT 0 NOT NULL,
	"timer_state" "question_timer_state" DEFAULT 'ready' NOT NULL,
	"remaining_ms" integer DEFAULT 60000 NOT NULL,
	"timer_deadline_at" timestamp with time zone,
	"resume_timer_on_reopen" boolean DEFAULT false NOT NULL,
	"memory_first_shown_at" timestamp with time zone,
	"memory_first_hidden_at" timestamp with time zone,
	"memory_image_visible" boolean DEFAULT false NOT NULL,
	"winning_team_number" smallint,
	"awarded_points" smallint,
	"resolved_by_account_id" uuid,
	"resolution_command_id" uuid,
	"resolved_at" timestamp with time zone,
	"feedback_vote" "feedback_vote",
	"feedback_by_account_id" uuid,
	"feedback_created_at" timestamp with time zone,
	"feedback_updated_at" timestamp with time zone,
	CONSTRAINT "game_questions_pkey" PRIMARY KEY("game_id","board_position","question_position"),
	CONSTRAINT "game_questions_snapshot_question_bounds" CHECK (question_position BETWEEN 1 AND 6),
	CONSTRAINT "game_questions_snapshot_point_band" CHECK (base_points = CASE WHEN question_position IN (1, 2) THEN 200 WHEN question_position IN (3, 4) THEN 400 ELSE 600 END),
	CONSTRAINT "game_questions_snapshot_schema_version" CHECK (snapshot_schema_version > 0),
	CONSTRAINT "game_questions_snapshot_snapshot_object" CHECK (jsonb_typeof(content_snapshot) = 'object'),
	CONSTRAINT "game_questions_snapshot_content_presence" CHECK ((content_snapshot IS NULL) = (content_purged_at IS NOT NULL)),
	CONSTRAINT "game_questions_runtime_nonnegative_stage" CHECK (stage_index >= 0),
	CONSTRAINT "game_questions_runtime_timer_bounds" CHECK (remaining_ms BETWEEN 0 AND 60000),
	CONSTRAINT "game_questions_runtime_timer_deadline_pair" CHECK ((timer_state = 'running') = (timer_deadline_at IS NOT NULL)),
	CONSTRAINT "game_questions_runtime_ready_duration" CHECK (timer_state <> 'ready' OR remaining_ms = 60000),
	CONSTRAINT "game_questions_runtime_elapsed_zero" CHECK ((timer_state = 'elapsed') = (remaining_ms = 0)),
	CONSTRAINT "game_questions_runtime_running_eligible" CHECK (timer_state <> 'running' OR (first_opened_at IS NOT NULL AND revealed_at IS NULL)),
	CONSTRAINT "game_questions_runtime_reopen_pause" CHECK (NOT resume_timer_on_reopen OR (timer_state = 'paused' AND revealed_at IS NULL)),
	CONSTRAINT "game_questions_runtime_reveal_order" CHECK (revealed_at IS NULL OR (first_opened_at IS NOT NULL AND revealed_at >= first_opened_at)),
	CONSTRAINT "game_questions_runtime_memory_show_order" CHECK (memory_first_shown_at IS NULL OR (first_opened_at IS NOT NULL AND memory_first_shown_at >= first_opened_at)),
	CONSTRAINT "game_questions_runtime_memory_hide_order" CHECK (memory_first_hidden_at IS NULL OR (memory_first_shown_at IS NOT NULL AND memory_first_hidden_at >= memory_first_shown_at)),
	CONSTRAINT "game_questions_runtime_memory_visibility" CHECK (NOT memory_image_visible OR memory_first_shown_at IS NOT NULL),
	CONSTRAINT "game_questions_runtime_unopened_defaults" CHECK (first_opened_at IS NOT NULL OR (revealed_at IS NULL AND stage_index = 0 AND timer_state = 'ready' AND NOT resume_timer_on_reopen AND memory_first_shown_at IS NULL AND memory_first_hidden_at IS NULL AND NOT memory_image_visible)),
	CONSTRAINT "game_questions_winner_bounds" CHECK (winning_team_number IS NULL OR winning_team_number IN (1, 2)),
	CONSTRAINT "game_questions_award_cap" CHECK (awarded_points IS NULL OR awarded_points BETWEEN 0 AND base_points),
	CONSTRAINT "game_questions_resolution_shape" CHECK ((resolved_at IS NULL AND winning_team_number IS NULL AND awarded_points IS NULL AND resolved_by_account_id IS NULL AND resolution_command_id IS NULL) OR (resolved_at IS NOT NULL AND awarded_points IS NOT NULL AND resolved_by_account_id IS NOT NULL AND resolution_command_id IS NOT NULL AND revealed_at IS NOT NULL AND resolved_at >= revealed_at AND (winning_team_number IS NOT NULL OR awarded_points = 0))),
	CONSTRAINT "game_questions_resolved_timer_stopped" CHECK (resolved_at IS NULL OR timer_state <> 'running'),
	CONSTRAINT "game_questions_feedback_shape" CHECK ((feedback_vote IS NULL AND feedback_by_account_id IS NULL AND feedback_created_at IS NULL AND feedback_updated_at IS NULL) OR (feedback_vote IS NOT NULL AND feedback_by_account_id IS NOT NULL AND feedback_created_at IS NOT NULL AND feedback_updated_at IS NOT NULL AND revealed_at IS NOT NULL AND feedback_created_at >= revealed_at AND feedback_updated_at >= feedback_created_at))
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" uuid PRIMARY KEY NOT NULL,
	"room_id" uuid NOT NULL,
	"sequence_number" integer NOT NULL,
	"status" "game_status" DEFAULT 'active' NOT NULL,
	"state_version" bigint DEFAULT 0 NOT NULL,
	"start_request_id" uuid NOT NULL,
	"start_request_digest" "bytea" NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"end_reason" "game_end_reason",
	"last_gameplay_at" timestamp with time zone NOT NULL,
	"idle_expires_at" timestamp with time zone NOT NULL,
	"first_question_opened_at" timestamp with time zone,
	"content_purge_after" timestamp with time zone,
	"content_purged_at" timestamp with time zone,
	"host_account_id" uuid NOT NULL,
	"team_one_name" text NOT NULL,
	"team_two_name" text NOT NULL,
	"team_one_score" bigint DEFAULT 0 NOT NULL,
	"team_two_score" bigint DEFAULT 0 NOT NULL,
	"active_board_position" smallint,
	"active_question_position" smallint,
	"controller_generation" bigint DEFAULT 1 NOT NULL,
	"controller_credential_hash" "bytea" NOT NULL,
	"controller_acquired_at" timestamp with time zone NOT NULL,
	CONSTRAINT "games_start_request_id_unique" UNIQUE("start_request_id"),
	CONSTRAINT "games_positive_sequence" CHECK (sequence_number > 0),
	CONSTRAINT "games_nonnegative_version" CHECK (state_version >= 0),
	CONSTRAINT "games_start_request_digest_shape" CHECK (octet_length(start_request_digest) = 32),
	CONSTRAINT "games_terminal_time" CHECK ((status IN ('finished', 'expired', 'failed')) = (ended_at IS NOT NULL)),
	CONSTRAINT "games_end_reason_pair" CHECK ((ended_at IS NULL) = (end_reason IS NULL)),
	CONSTRAINT "games_activity_order" CHECK (last_gameplay_at >= started_at),
	CONSTRAINT "games_end_order" CHECK (ended_at IS NULL OR ended_at >= last_gameplay_at),
	CONSTRAINT "games_fixed_idle_window" CHECK (idle_expires_at = last_gameplay_at + interval '24 hours'),
	CONSTRAINT "games_reason_matches_state" CHECK (end_reason IS NULL OR (status = 'finished' AND end_reason IN ('completed', 'host_ended', 'host_left')) OR (status = 'expired' AND end_reason = 'idle_timeout') OR (status = 'failed' AND end_reason = 'platform_failure')),
	CONSTRAINT "games_effective_expiry_time" CHECK (status <> 'expired' OR ended_at = idle_expires_at),
	CONSTRAINT "games_first_open_time" CHECK (first_question_opened_at IS NULL OR (started_at IS NOT NULL AND first_question_opened_at >= started_at AND (ended_at IS NULL OR first_question_opened_at <= ended_at))),
	CONSTRAINT "games_completion_requires_opening" CHECK (end_reason IS DISTINCT FROM 'completed' OR first_question_opened_at IS NOT NULL),
	CONSTRAINT "games_content_retention_presence" CHECK ((ended_at IS NULL) = (content_purge_after IS NULL)),
	CONSTRAINT "games_content_retention_window" CHECK (content_purge_after IS NULL OR content_purge_after = ended_at + interval '12 months'),
	CONSTRAINT "games_content_purge_order" CHECK (content_purged_at IS NULL OR (content_purge_after IS NOT NULL AND content_purged_at >= content_purge_after)),
	CONSTRAINT "games_team_names" CHECK (length(btrim(team_one_name)) > 0 AND length(btrim(team_two_name)) > 0),
	CONSTRAINT "games_nonnegative_scores" CHECK (team_one_score >= 0 AND team_two_score >= 0),
	CONSTRAINT "games_active_pointer_pair" CHECK ((active_board_position IS NULL) = (active_question_position IS NULL)),
	CONSTRAINT "games_active_pointer_bounds" CHECK (active_board_position IS NULL OR (active_board_position BETWEEN 1 AND 6 AND active_question_position BETWEEN 1 AND 6)),
	CONSTRAINT "games_terminal_board" CHECK (status = 'active' OR active_board_position IS NULL),
	CONSTRAINT "games_controller_shape" CHECK (controller_generation > 0 AND octet_length(controller_credential_hash) = 32),
	CONSTRAINT "games_controller_acquisition" CHECK (controller_acquired_at >= started_at)
);
--> statement-breakpoint
CREATE TABLE "account_pack_completions" (
	"account_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"board_position" smallint NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_pack_completions_pkey" PRIMARY KEY("account_id","game_id","board_position")
);
--> statement-breakpoint
CREATE TABLE "account_question_exposures" (
	"account_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"first_exposed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"first_game_id" uuid,
	CONSTRAINT "account_question_exposures_pkey" PRIMARY KEY("account_id","question_id")
);
--> statement-breakpoint
CREATE TABLE "promo_usages" (
	"order_id" uuid PRIMARY KEY NOT NULL,
	"promotion_id" uuid NOT NULL,
	"buyer_account_id" uuid NOT NULL,
	"state" "promo_usage_state" DEFAULT 'held' NOT NULL,
	"held_at" timestamp with time zone DEFAULT now() NOT NULL,
	"consumed_at" timestamp with time zone,
	"released_at" timestamp with time zone,
	"release_reason" text,
	"buyer_phone_fingerprint" "bytea",
	"phone_fingerprint_key_version" smallint NOT NULL,
	"phone_fingerprint_cleared_at" timestamp with time zone,
	CONSTRAINT "promo_usages_fingerprint_redaction_order" CHECK (phone_fingerprint_cleared_at IS NULL OR phone_fingerprint_cleared_at >= held_at),
	CONSTRAINT "promo_usages_fingerprint_shape" CHECK (buyer_phone_fingerprint IS NULL OR octet_length(buyer_phone_fingerprint) = 32),
	CONSTRAINT "promo_usages_fingerprint_presence" CHECK ((buyer_phone_fingerprint IS NULL) = (phone_fingerprint_cleared_at IS NOT NULL)),
	CONSTRAINT "promo_usages_state_times" CHECK ((state = 'held' AND consumed_at IS NULL AND released_at IS NULL) OR (state = 'consumed' AND consumed_at IS NOT NULL AND released_at IS NULL) OR (state = 'released' AND consumed_at IS NULL AND released_at IS NOT NULL)),
	CONSTRAINT "promo_usages_consumption_order" CHECK (consumed_at IS NULL OR consumed_at >= held_at),
	CONSTRAINT "promo_usages_release_order" CHECK (released_at IS NULL OR (released_at >= held_at AND (consumed_at IS NULL OR released_at >= consumed_at))),
	CONSTRAINT "promo_usages_release_reason" CHECK (state <> 'released' OR (release_reason IS NOT NULL AND length(btrim(release_reason)) > 0))
);
--> statement-breakpoint
CREATE TABLE "promotions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"trigger" "promotion_trigger" DEFAULT 'code' NOT NULL,
	"code" varchar(64),
	"discount_bps" smallint NOT NULL,
	"eligible_bundle_quantity" integer NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"maximum_redemptions" integer,
	"per_buyer_limit" integer DEFAULT 1,
	"is_active" boolean DEFAULT true NOT NULL,
	"phone_fingerprint_key_version" smallint DEFAULT 1 NOT NULL,
	CONSTRAINT "promotions_code_unique" UNIQUE("code"),
	CONSTRAINT "promotions_positive_fingerprint_key" CHECK (phone_fingerprint_key_version > 0),
	CONSTRAINT "promotions_trigger_shape" CHECK ((trigger = 'code' AND code IS NOT NULL AND length(btrim(code)) > 0) OR (trigger = 'automatic_free' AND code IS NULL AND discount_bps = 10000)),
	CONSTRAINT "promotions_discount" CHECK (discount_bps BETWEEN 1 AND 10000),
	CONSTRAINT "promotions_valid_window" CHECK (ends_at > starts_at),
	CONSTRAINT "promotions_global_limit" CHECK (maximum_redemptions IS NULL OR maximum_redemptions > 0),
	CONSTRAINT "promotions_buyer_limit" CHECK (per_buyer_limit IS NULL OR per_buyer_limit > 0),
	CONSTRAINT "promotions_fixed_bundle" CHECK (eligible_bundle_quantity IN (1, 2, 5))
);
--> statement-breakpoint
CREATE TABLE "shop_settings" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"currency" char(3) DEFAULT 'EGP' NOT NULL,
	"base_unit_price_minor" bigint DEFAULT 10000 NOT NULL,
	"gift_discount_bps" smallint NOT NULL,
	"pricing_version" bigint DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"quantity_tiers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"bundles" jsonb DEFAULT '[{"quantity":1,"is_active":true,"display_order":0},{"quantity":2,"is_active":true,"display_order":1},{"quantity":5,"is_active":true,"display_order":2}]'::jsonb NOT NULL,
	CONSTRAINT "shop_settings_singleton" CHECK (id = 1),
	CONSTRAINT "shop_settings_currency" CHECK (currency = 'EGP'),
	CONSTRAINT "shop_settings_positive_price" CHECK (base_unit_price_minor > 0),
	CONSTRAINT "shop_settings_gift_discount" CHECK (gift_discount_bps BETWEEN 0 AND 10000),
	CONSTRAINT "shop_settings_positive_version" CHECK (pricing_version > 0),
	CONSTRAINT "shop_settings_bounded_tiers" CHECK (jsonb_typeof(quantity_tiers) = 'array' AND jsonb_array_length(quantity_tiers) <= 20),
	CONSTRAINT "shop_settings_fixed_bundles" CHECK (jsonb_typeof(bundles) = 'array' AND jsonb_array_length(bundles) = 3)
);
--> statement-breakpoint
CREATE TABLE "token_ledger_entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"entry_kind" "token_entry_kind" NOT NULL,
	"amount" integer NOT NULL,
	"idempotency_key" varchar(160) NOT NULL,
	"source_order_id" uuid,
	"source_order_settlement_kind" "settlement_kind",
	"deletion_request_id" uuid,
	"staff_audit_event_id" uuid,
	"game_id" uuid,
	"source_debit_id" uuid,
	"source_debit_kind" "token_entry_kind",
	"restoration_reason" "game_restoration_reason",
	"reason_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "token_ledger_entries_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "token_ledger_entries_source_order_id_unique" UNIQUE("source_order_id"),
	CONSTRAINT "token_ledger_entries_deletion_request_id_unique" UNIQUE("deletion_request_id"),
	CONSTRAINT "token_ledger_entries_staff_audit_event_id_unique" UNIQUE("staff_audit_event_id"),
	CONSTRAINT "token_ledger_entries_effect_shape" CHECK ((entry_kind = 'credit' AND amount > 0 AND game_id IS NULL AND source_debit_id IS NULL AND source_debit_kind IS NULL AND restoration_reason IS NULL AND ((source_order_id IS NOT NULL AND source_order_settlement_kind IS NOT NULL AND staff_audit_event_id IS NULL) OR (source_order_id IS NULL AND source_order_settlement_kind IS NULL AND staff_audit_event_id IS NOT NULL AND reason_text IS NOT NULL AND length(btrim(reason_text)) > 0))) OR (entry_kind = 'game_debit' AND amount = -1 AND source_order_id IS NULL AND source_order_settlement_kind IS NULL AND staff_audit_event_id IS NULL AND game_id IS NOT NULL AND source_debit_id IS NULL AND source_debit_kind IS NULL AND restoration_reason IS NULL) OR (entry_kind = 'game_restoration' AND amount = 1 AND source_order_id IS NULL AND source_order_settlement_kind IS NULL AND game_id IS NOT NULL AND source_debit_id IS NOT NULL AND source_debit_kind IS NOT NULL AND source_debit_kind = 'game_debit' AND restoration_reason IS NOT NULL) OR (entry_kind = 'deletion_forfeiture' AND amount < 0 AND source_order_id IS NULL AND source_order_settlement_kind IS NULL AND staff_audit_event_id IS NULL AND game_id IS NULL AND source_debit_id IS NULL AND source_debit_kind IS NULL AND restoration_reason IS NULL AND reason_text IS NOT NULL AND length(btrim(reason_text)) > 0)),
	CONSTRAINT "token_ledger_entries_deletion_source" CHECK ((entry_kind = 'deletion_forfeiture') = (deletion_request_id IS NOT NULL)),
	CONSTRAINT "token_ledger_entries_failure_reason" CHECK (restoration_reason IS DISTINCT FROM 'platform_failure' OR (staff_audit_event_id IS NOT NULL AND reason_text IS NOT NULL AND length(btrim(reason_text)) > 0)),
	CONSTRAINT "token_ledger_entries_automatic_restore" CHECK (restoration_reason IS DISTINCT FROM 'unopened_game' OR staff_audit_event_id IS NULL)
);
--> statement-breakpoint
CREATE TABLE "token_orders" (
	"id" uuid PRIMARY KEY NOT NULL,
	"buyer_account_id" uuid NOT NULL,
	"order_kind" "token_order_kind" NOT NULL,
	"beneficiary_account_id" uuid,
	"token_quantity" integer NOT NULL,
	"currency" char(3),
	"pricing_version" bigint,
	"price_tier_minimum_quantity" smallint,
	"base_unit_price_minor" bigint,
	"quantity_discount_bps" smallint,
	"list_subtotal_minor" bigint,
	"quantity_discount_minor" bigint,
	"offer_subtotal_minor" bigint,
	"additional_discount_kind" "applied_discount_kind",
	"additional_discount_bps" smallint,
	"applied_promotion_id" uuid,
	"applied_promotion_trigger" "promotion_trigger",
	"additional_discount_minor" bigint,
	"total_minor" bigint,
	"payment_state" "order_payment_state" DEFAULT 'pending' NOT NULL,
	"verified_paid_at" timestamp with time zone,
	"zero_total_accepted_at" timestamp with time zone,
	"idempotency_key" uuid NOT NULL,
	"request_digest" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"recipient_phone_e164" varchar(20),
	"gift_note" text,
	"recipient_bound_at" timestamp with time zone,
	"recipient_phone_redacted_at" timestamp with time zone,
	"gift_note_redacted_at" timestamp with time zone,
	"settlement_kind" "settlement_kind",
	"settlement_payment_transaction_id" uuid,
	"settlement_payment_kind" "payment_transaction_kind",
	"settlement_verification_event_id" uuid,
	"settled_at" timestamp with time zone,
	"purchase_channel" varchar(24) DEFAULT 'paymob' NOT NULL,
	"store_product_id" uuid,
	"native_verified_at" timestamp with time zone,
	"settlement_store_purchase_id" uuid,
	CONSTRAINT "token_orders_store_channel" CHECK (settlement_kind IS DISTINCT FROM 'native_store' OR purchase_channel IN ('apple_app_store','google_play')),
	CONSTRAINT "token_orders_free_channel" CHECK (settlement_kind IS DISTINCT FROM 'zero_cost' OR (purchase_channel = 'paymob' AND total_minor = 0)),
	CONSTRAINT "token_orders_paid_channel" CHECK (settlement_kind IS DISTINCT FROM 'payment' OR (purchase_channel = 'paymob' AND total_minor > 0)),
	CONSTRAINT "token_orders_proof_presence" CHECK ((settlement_kind IS NOT NULL AND settlement_kind IN ('payment','native_store')) = (settlement_verification_event_id IS NOT NULL)),
	CONSTRAINT "token_orders_native_source_presence" CHECK ((settlement_kind IS NOT DISTINCT FROM 'native_store') = (settlement_store_purchase_id IS NOT NULL)),
	CONSTRAINT "token_orders_web_payment_source" CHECK (CASE WHEN settlement_kind = 'payment' THEN settlement_payment_transaction_id IS NOT NULL AND settlement_payment_kind IS NOT NULL AND settlement_payment_kind IN ('payment','capture') ELSE settlement_payment_transaction_id IS NULL AND settlement_payment_kind IS NULL END),
	CONSTRAINT "token_orders_native_settlement_kind" CHECK ((settlement_kind IS NOT DISTINCT FROM 'native_store') = (payment_state = 'store_verified')),
	CONSTRAINT "token_orders_free_settlement_kind" CHECK ((settlement_kind IS NOT DISTINCT FROM 'zero_cost') = (payment_state = 'not_required')),
	CONSTRAINT "token_orders_paid_settlement_kind" CHECK ((settlement_kind IS NOT DISTINCT FROM 'payment') = (payment_state = 'paid')),
	CONSTRAINT "token_orders_settlement_time_pair" CHECK ((settlement_kind IS NULL) = (settled_at IS NULL)),
	CONSTRAINT "token_orders_channel_fields" CHECK (CASE WHEN purchase_channel = 'paymob' THEN store_product_id IS NULL AND native_verified_at IS NULL AND payment_state IN ('pending','paid','not_required','cancelled') ELSE store_product_id IS NOT NULL AND order_kind = 'personal' AND payment_state IN ('pending','cancelled','store_verified') END),
	CONSTRAINT "token_orders_native_quote_absent" CHECK (purchase_channel = 'paymob' OR (currency IS NULL AND pricing_version IS NULL AND base_unit_price_minor IS NULL AND quantity_discount_bps IS NULL AND list_subtotal_minor IS NULL AND quantity_discount_minor IS NULL AND offer_subtotal_minor IS NULL AND additional_discount_kind IS NULL AND additional_discount_bps IS NULL AND additional_discount_minor IS NULL AND total_minor IS NULL AND price_tier_minimum_quantity IS NULL AND applied_promotion_id IS NULL AND applied_promotion_trigger IS NULL)),
	CONSTRAINT "token_orders_web_quote_required" CHECK (purchase_channel <> 'paymob' OR (currency IS NOT NULL AND pricing_version IS NOT NULL AND base_unit_price_minor IS NOT NULL AND quantity_discount_bps IS NOT NULL AND list_subtotal_minor IS NOT NULL AND quantity_discount_minor IS NOT NULL AND offer_subtotal_minor IS NOT NULL AND additional_discount_kind IS NOT NULL AND additional_discount_bps IS NOT NULL AND additional_discount_minor IS NOT NULL AND total_minor IS NOT NULL)),
	CONSTRAINT "token_orders_phone_redaction_order" CHECK (recipient_phone_redacted_at IS NULL OR (recipient_bound_at IS NOT NULL AND recipient_phone_redacted_at >= recipient_bound_at)),
	CONSTRAINT "token_orders_note_redaction" CHECK (gift_note_redacted_at IS NULL OR (order_kind = 'gift' AND gift_note IS NULL AND gift_note_redacted_at >= created_at)),
	CONSTRAINT "token_orders_funding_time_order" CHECK (settled_at IS NULL OR settled_at >= coalesce(verified_paid_at, zero_total_accepted_at, native_verified_at)),
	CONSTRAINT "token_orders_paid_time_order" CHECK (verified_paid_at IS NULL OR verified_paid_at >= created_at),
	CONSTRAINT "token_orders_request_digest_shape" CHECK (octet_length(request_digest) = 32),
	CONSTRAINT "token_orders_quantity_cap" CHECK (token_quantity BETWEEN 1 AND 20),
	CONSTRAINT "token_orders_currency" CHECK (purchase_channel <> 'paymob' OR (currency = 'EGP')),
	CONSTRAINT "token_orders_price_basis" CHECK (purchase_channel <> 'paymob' OR (pricing_version > 0 AND base_unit_price_minor > 0)),
	CONSTRAINT "token_orders_discount_bounds" CHECK (purchase_channel <> 'paymob' OR (quantity_discount_bps BETWEEN 0 AND 10000 AND additional_discount_bps BETWEEN 0 AND 10000)),
	CONSTRAINT "token_orders_list_total" CHECK (purchase_channel <> 'paymob' OR (list_subtotal_minor = token_quantity::numeric * base_unit_price_minor)),
	CONSTRAINT "token_orders_quantity_reduction" CHECK (purchase_channel <> 'paymob' OR (quantity_discount_minor = round(list_subtotal_minor::numeric * quantity_discount_bps / 10000))),
	CONSTRAINT "token_orders_offer_total" CHECK (purchase_channel <> 'paymob' OR (offer_subtotal_minor = list_subtotal_minor - quantity_discount_minor)),
	CONSTRAINT "token_orders_extra_reduction" CHECK (purchase_channel <> 'paymob' OR (additional_discount_minor = round(offer_subtotal_minor::numeric * additional_discount_bps / 10000))),
	CONSTRAINT "token_orders_payable_total" CHECK (purchase_channel <> 'paymob' OR (total_minor = offer_subtotal_minor - additional_discount_minor AND total_minor >= 0)),
	CONSTRAINT "token_orders_beneficiary_shape" CHECK ((order_kind = 'personal' AND beneficiary_account_id IS NOT NULL AND beneficiary_account_id = buyer_account_id) OR (order_kind = 'gift' AND (beneficiary_account_id IS NULL OR beneficiary_account_id <> buyer_account_id))),
	CONSTRAINT "token_orders_one_extra_discount" CHECK (purchase_channel <> 'paymob' OR ((additional_discount_kind = 'none' AND additional_discount_bps = 0) OR (additional_discount_kind = 'gift' AND order_kind = 'gift' AND additional_discount_bps > 0) OR (additional_discount_kind = 'promo_code' AND additional_discount_bps > 0 AND applied_promotion_id IS NOT NULL))),
	CONSTRAINT "token_orders_promotion_trigger_pair" CHECK ((applied_promotion_id IS NULL) = (applied_promotion_trigger IS NULL)),
	CONSTRAINT "token_orders_promotion_application" CHECK (purchase_channel <> 'paymob' OR ((applied_promotion_trigger IS NULL AND additional_discount_kind <> 'promo_code') OR (applied_promotion_trigger = 'code' AND additional_discount_kind = 'promo_code') OR (applied_promotion_trigger = 'automatic_free' AND additional_discount_kind <> 'promo_code' AND total_minor = 0))),
	CONSTRAINT "token_orders_promo_fixed_bundle" CHECK (applied_promotion_id IS NULL OR token_quantity IN (1, 2, 5)),
	CONSTRAINT "token_orders_free_campaign_required" CHECK (purchase_channel <> 'paymob' OR (total_minor <> 0 OR applied_promotion_id IS NOT NULL)),
	CONSTRAINT "token_orders_payment_marker" CHECK ((payment_state = 'paid') = (verified_paid_at IS NOT NULL)),
	CONSTRAINT "token_orders_zero_marker" CHECK ((payment_state = 'not_required') = (zero_total_accepted_at IS NOT NULL)),
	CONSTRAINT "token_orders_settlement_amount" CHECK (purchase_channel <> 'paymob' OR ((total_minor = 0 AND payment_state IN ('not_required', 'cancelled')) OR (total_minor > 0 AND payment_state IN ('pending', 'paid', 'cancelled')))),
	CONSTRAINT "token_orders_zero_acceptance_order" CHECK (zero_total_accepted_at IS NULL OR zero_total_accepted_at >= created_at),
	CONSTRAINT "token_orders_tier_snapshot" CHECK (price_tier_minimum_quantity IS NULL OR price_tier_minimum_quantity BETWEEN 1 AND token_quantity),
	CONSTRAINT "token_orders_gift_fields" CHECK ((order_kind = 'personal' AND recipient_phone_e164 IS NULL AND gift_note IS NULL AND recipient_bound_at IS NULL AND recipient_phone_redacted_at IS NULL AND gift_note_redacted_at IS NULL) OR (order_kind = 'gift' AND ((beneficiary_account_id IS NULL) = (recipient_bound_at IS NULL)) AND ((recipient_phone_redacted_at IS NULL AND recipient_phone_e164 IS NOT NULL AND recipient_phone_e164 ~ '^\+[1-9][0-9]{7,14}$' AND left(recipient_phone_e164, 3) = '+20') OR (recipient_phone_redacted_at IS NOT NULL AND recipient_phone_e164 IS NULL AND beneficiary_account_id IS NOT NULL)))),
	CONSTRAINT "token_orders_gift_binding_order" CHECK (recipient_bound_at IS NULL OR recipient_bound_at >= created_at),
	CONSTRAINT "token_orders_settlement_presence" CHECK ((payment_state IN ('paid', 'not_required', 'store_verified')) = (settlement_kind IS NOT NULL)),
	CONSTRAINT "token_orders_settlement_order" CHECK (settled_at IS NULL OR settled_at >= created_at),
	CONSTRAINT "token_orders_purchase_channel" CHECK (purchase_channel IN ('paymob', 'apple_app_store', 'google_play')),
	CONSTRAINT "token_orders_native_verification_marker" CHECK ((payment_state = 'store_verified') = (native_verified_at IS NOT NULL)),
	CONSTRAINT "token_orders_native_verification_order" CHECK (native_verified_at IS NULL OR native_verified_at >= created_at)
);
--> statement-breakpoint
CREATE TABLE "payment_attempts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"order_id" uuid NOT NULL,
	"provider" varchar(24) DEFAULT 'paymob' NOT NULL,
	"environment" "payment_environment" NOT NULL,
	"provider_namespace" varchar(160) NOT NULL,
	"configuration_key" varchar(80) NOT NULL,
	"request_key" uuid NOT NULL,
	"state" "payment_attempt_state" DEFAULT 'initializing' NOT NULL,
	"special_reference" varchar(160) NOT NULL,
	"allowed_integration_ids" text[] NOT NULL,
	"checkout_credentials_ciphertext" "bytea",
	"encryption_key_version" smallint,
	"created_at" timestamp with time zone NOT NULL,
	"provider_expires_at" timestamp with time zone,
	"confirmed_unpaid_at" timestamp with time zone,
	"closure_verification_event_id" uuid,
	"last_inquired_at" timestamp with time zone,
	CONSTRAINT "payment_attempts_paymob_channel" CHECK (provider = 'paymob'),
	CONSTRAINT "payment_attempts_nonblank_reference" CHECK (length(btrim(special_reference)) > 0),
	CONSTRAINT "payment_attempts_integrations_present" CHECK (cardinality(allowed_integration_ids) > 0 AND array_position(allowed_integration_ids, NULL) IS NULL),
	CONSTRAINT "payment_attempts_encryption_pair" CHECK ((checkout_credentials_ciphertext IS NULL) = (encryption_key_version IS NULL)),
	CONSTRAINT "payment_attempts_encryption_version" CHECK (encryption_key_version IS NULL OR encryption_key_version > 0),
	CONSTRAINT "payment_attempts_unpaid_confirmation" CHECK ((state = 'closed_unpaid') = (confirmed_unpaid_at IS NOT NULL)),
	CONSTRAINT "payment_attempts_closure_proof_pair" CHECK ((confirmed_unpaid_at IS NULL) = (closure_verification_event_id IS NULL)),
	CONSTRAINT "payment_attempts_confirmation_order" CHECK (confirmed_unpaid_at IS NULL OR confirmed_unpaid_at >= created_at),
	CONSTRAINT "payment_attempts_expiry_order" CHECK (provider_expires_at IS NULL OR provider_expires_at > created_at),
	CONSTRAINT "payment_attempts_namespace" CHECK (length(btrim(provider)) > 0 AND length(btrim(provider_namespace)) > 0 AND length(btrim(configuration_key)) > 0)
);
--> statement-breakpoint
CREATE TABLE "payment_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"provider" varchar(24) DEFAULT 'paymob' NOT NULL,
	"environment" "payment_environment" NOT NULL,
	"provider_namespace" varchar(160) NOT NULL,
	"configuration_key" varchar(80) NOT NULL,
	"verification_method" "payment_verification_method" NOT NULL,
	"fingerprint" "bytea",
	"notification_type" varchar(40),
	"provider_transaction_id" text,
	"provider_order_reference" text,
	"attempt_id" uuid,
	"transaction_id" uuid,
	"facts_hash" "bytea" NOT NULL,
	"verified_facts" jsonb NOT NULL,
	"observed_payment_outcome" "payment_outcome",
	"observed_native_state" "store_purchase_state",
	"observed_native_product_id" varchar(256),
	"observed_native_units" integer,
	"confirms_closed_unpaid" boolean DEFAULT false NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"verified_at" timestamp with time zone NOT NULL,
	"state" "payment_receipt_state" DEFAULT 'queued' NOT NULL,
	"processed_at" timestamp with time zone,
	"last_error_code" varchar(80),
	"native_purchase_id" uuid,
	"native_notification_id" varchar(160),
	"origin_event_id" uuid,
	CONSTRAINT "payment_events_processed_payment_outcome" CHECK (state <> 'processed' OR transaction_id IS NULL OR observed_payment_outcome IS NOT NULL),
	CONSTRAINT "payment_events_native_units" CHECK (observed_native_units IS NULL OR observed_native_units > 0),
	CONSTRAINT "payment_events_purchased_item" CHECK (observed_native_state IS DISTINCT FROM 'purchased' OR (observed_native_product_id IS NOT NULL AND length(btrim(observed_native_product_id)) > 0 AND observed_native_units IS NOT NULL AND observed_native_units > 0)),
	CONSTRAINT "payment_events_native_observation" CHECK (CASE WHEN verification_method IN ('apple_store_jws', 'google_play_api') THEN native_purchase_id IS NOT NULL AND observed_native_state IS NOT NULL ELSE observed_native_state IS NULL AND observed_native_product_id IS NULL AND observed_native_units IS NULL END),
	CONSTRAINT "payment_events_inquiry_attempt" CHECK (verification_method <> 'authenticated_inquiry' OR attempt_id IS NOT NULL),
	CONSTRAINT "payment_events_notification_type" CHECK (CASE WHEN verification_method IN ('hmac_callback', 'apple_store_notification', 'google_play_rtdn') THEN notification_type IS NOT NULL AND length(btrim(notification_type)) > 0 ELSE notification_type IS NULL END),
	CONSTRAINT "payment_events_delivery_fingerprint" CHECK ((verification_method IN ('hmac_callback', 'apple_store_notification', 'google_play_rtdn')) = (fingerprint IS NOT NULL)),
	CONSTRAINT "payment_events_native_fields" CHECK (provider = 'paymob' OR (attempt_id IS NULL AND transaction_id IS NULL AND observed_payment_outcome IS NULL AND NOT confirms_closed_unpaid)),
	CONSTRAINT "payment_events_paymob_fields" CHECK (provider <> 'paymob' OR (native_purchase_id IS NULL AND native_notification_id IS NULL AND observed_native_state IS NULL AND observed_native_product_id IS NULL AND observed_native_units IS NULL)),
	CONSTRAINT "payment_events_provider_method" CHECK (CASE provider WHEN 'paymob' THEN verification_method IN ('hmac_callback', 'authenticated_inquiry') WHEN 'apple_app_store' THEN verification_method IN ('apple_store_jws', 'apple_store_notification') WHEN 'google_play' THEN verification_method IN ('google_play_api', 'google_play_rtdn') ELSE false END),
	CONSTRAINT "payment_events_supported_provider" CHECK (provider IN ('paymob', 'apple_app_store', 'google_play')),
	CONSTRAINT "payment_events_fingerprint_shape" CHECK (fingerprint IS NULL OR octet_length(fingerprint) = 32),
	CONSTRAINT "payment_events_facts_shape" CHECK (octet_length(facts_hash) = 32 AND jsonb_typeof(verified_facts) = 'object'),
	CONSTRAINT "payment_events_namespace" CHECK (length(btrim(provider)) > 0 AND length(btrim(provider_namespace)) > 0 AND length(btrim(configuration_key)) > 0),
	CONSTRAINT "payment_events_verification_order" CHECK (verified_at >= received_at),
	CONSTRAINT "payment_events_processing_pair" CHECK ((state IN ('processed', 'ignored')) = (processed_at IS NOT NULL)),
	CONSTRAINT "payment_events_processing_order" CHECK (processed_at IS NULL OR processed_at >= verified_at),
	CONSTRAINT "payment_events_transaction_attempt" CHECK (transaction_id IS NULL OR attempt_id IS NOT NULL),
	CONSTRAINT "payment_events_processed_callback_mapping" CHECK (verification_method <> 'hmac_callback' OR state <> 'processed' OR transaction_id IS NOT NULL),
	CONSTRAINT "payment_events_closure_shape" CHECK (NOT confirms_closed_unpaid OR (verification_method = 'authenticated_inquiry' AND transaction_id IS NULL)),
	CONSTRAINT "payment_events_no_self_origin" CHECK (origin_event_id IS NULL OR origin_event_id <> id),
	CONSTRAINT "payment_events_native_notification_identity" CHECK ((native_notification_id IS NOT NULL) = (verification_method IN ('apple_store_notification', 'google_play_rtdn'))),
	CONSTRAINT "payment_events_processed_native_mapping" CHECK (state <> 'processed' OR verification_method NOT IN ('apple_store_notification', 'google_play_rtdn') OR native_purchase_id IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "payment_provider_references" (
	"provider" varchar(24) DEFAULT 'paymob' NOT NULL,
	"environment" "payment_environment" NOT NULL,
	"provider_namespace" varchar(160) NOT NULL,
	"reference_kind" "provider_reference_kind" NOT NULL,
	"provider_reference" text NOT NULL,
	"attempt_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	CONSTRAINT "payment_provider_references_pkey" PRIMARY KEY("provider","environment","provider_namespace","reference_kind","provider_reference"),
	CONSTRAINT "payment_provider_references_nonblank" CHECK (length(btrim(provider_reference)) > 0)
);
--> statement-breakpoint
CREATE TABLE "payment_reconciliation_cases" (
	"id" uuid PRIMARY KEY NOT NULL,
	"case_key" varchar(160) NOT NULL,
	"case_type" varchar(48) NOT NULL,
	"state" "reconciliation_state" DEFAULT 'open' NOT NULL,
	"order_id" uuid,
	"attempt_id" uuid,
	"transaction_id" uuid,
	"payment_event_id" uuid,
	"native_purchase_id" uuid,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"opened_at" timestamp with time zone NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolution_audit_event_id" uuid,
	CONSTRAINT "payment_reconciliation_cases_case_key_unique" UNIQUE("case_key"),
	CONSTRAINT "payment_reconciliation_cases_details_shape" CHECK (length(btrim(case_type)) > 0 AND jsonb_typeof(details) = 'object'),
	CONSTRAINT "payment_reconciliation_cases_evidence_present" CHECK (order_id IS NOT NULL OR attempt_id IS NOT NULL OR transaction_id IS NOT NULL OR payment_event_id IS NOT NULL OR native_purchase_id IS NOT NULL),
	CONSTRAINT "payment_reconciliation_cases_resolution_time" CHECK ((state = 'resolved') = (resolved_at IS NOT NULL)),
	CONSTRAINT "payment_reconciliation_cases_resolution_actor" CHECK ((resolved_at IS NULL) = (resolution_audit_event_id IS NULL)),
	CONSTRAINT "payment_reconciliation_cases_time_order" CHECK (resolved_at IS NULL OR resolved_at >= opened_at)
);
--> statement-breakpoint
CREATE TABLE "payment_transactions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"provider" varchar(24) DEFAULT 'paymob' NOT NULL,
	"environment" "payment_environment" NOT NULL,
	"provider_namespace" varchar(160) NOT NULL,
	"provider_transaction_id" text NOT NULL,
	"transaction_kind" "payment_transaction_kind" DEFAULT 'payment' NOT NULL,
	"parent_transaction_id" uuid,
	"attempt_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"integration_id" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" char(3) NOT NULL,
	"outcome" "payment_outcome" DEFAULT 'pending' NOT NULL,
	"captured_minor" bigint DEFAULT 0 NOT NULL,
	"refunded_minor" bigint DEFAULT 0 NOT NULL,
	"last_verification_event_id" uuid,
	"last_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "payment_transactions_paymob_channel" CHECK (provider = 'paymob'),
	CONSTRAINT "payment_transactions_nonblank_references" CHECK (length(btrim(provider_transaction_id)) > 0 AND length(btrim(integration_id)) > 0),
	CONSTRAINT "payment_transactions_amount_bounds" CHECK (amount_minor > 0 AND captured_minor BETWEEN 0 AND amount_minor AND refunded_minor BETWEEN 0 AND captured_minor),
	CONSTRAINT "payment_transactions_verification_pair" CHECK ((last_verification_event_id IS NULL) = (last_verified_at IS NULL)),
	CONSTRAINT "payment_transactions_verification_order" CHECK (last_verified_at IS NULL OR last_verified_at >= created_at),
	CONSTRAINT "payment_transactions_action_parent" CHECK (transaction_kind = 'payment' OR parent_transaction_id IS NOT NULL),
	CONSTRAINT "payment_transactions_no_self_parent" CHECK (parent_transaction_id IS NULL OR parent_transaction_id <> id)
);
--> statement-breakpoint
CREATE TABLE "store_products" (
	"id" uuid PRIMARY KEY NOT NULL,
	"provider" varchar(24) NOT NULL,
	"application_id" varchar(160) NOT NULL,
	"provider_product_id" varchar(256) NOT NULL,
	"token_quantity" integer NOT NULL,
	"target_egp_price_minor" bigint,
	"is_active" boolean DEFAULT true NOT NULL,
	"updated_by_staff_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "store_products_launch_scope" CHECK (provider IN ('apple_app_store', 'google_play') AND token_quantity IN (1, 2, 5)),
	CONSTRAINT "store_products_nonblank_identity" CHECK (length(btrim(application_id)) > 0 AND length(btrim(provider_product_id)) > 0),
	CONSTRAINT "store_products_price_target" CHECK (target_egp_price_minor IS NULL OR target_egp_price_minor >= 0),
	CONSTRAINT "store_products_update_order" CHECK (updated_at >= created_at)
);
--> statement-breakpoint
CREATE TABLE "store_purchases" (
	"id" uuid PRIMARY KEY NOT NULL,
	"provider" varchar(24) NOT NULL,
	"environment" "payment_environment" NOT NULL,
	"application_id" varchar(160) NOT NULL,
	"provider_product_id" varchar(256),
	"store_product_id" uuid,
	"product_token_quantity" integer,
	"purchased_units" integer,
	"verified_token_quantity" integer,
	"store_transaction_id" text,
	"provider_order_reference" text,
	"purchase_token_hash" "bytea",
	"purchase_token_ciphertext" "bytea",
	"encryption_key_version" smallint,
	"intended_order_id" uuid,
	"buyer_account_id" uuid,
	"attributed_at" timestamp with time zone,
	"state" "store_purchase_state" DEFAULT 'pending' NOT NULL,
	"latest_verification_event_id" uuid,
	"last_verified_at" timestamp with time zone,
	"price_amount" numeric(20, 6),
	"price_currency" char(3),
	"verified_offer_details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"completion_state" "store_completion_state" DEFAULT 'not_required' NOT NULL,
	"completion_requested_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "store_purchases_purchase_token_hash_unique" UNIQUE("purchase_token_hash"),
	CONSTRAINT "store_purchases_namespace" CHECK (provider IN ('apple_app_store', 'google_play') AND length(btrim(application_id)) > 0 AND (provider_product_id IS NULL OR length(btrim(provider_product_id)) > 0)),
	CONSTRAINT "store_purchases_provider_identity" CHECK ((provider = 'apple_app_store' AND store_transaction_id IS NOT NULL AND length(btrim(store_transaction_id)) > 0 AND purchase_token_hash IS NULL AND purchase_token_ciphertext IS NULL AND encryption_key_version IS NULL) OR (provider = 'google_play' AND store_transaction_id IS NULL AND purchase_token_hash IS NOT NULL AND octet_length(purchase_token_hash) = 32 AND purchase_token_ciphertext IS NOT NULL AND encryption_key_version IS NOT NULL AND encryption_key_version > 0)),
	CONSTRAINT "store_purchases_mapping_pair" CHECK (((store_product_id IS NULL) = (product_token_quantity IS NULL)) AND (store_product_id IS NULL OR provider_product_id IS NOT NULL)),
	CONSTRAINT "store_purchases_positive_units" CHECK (purchased_units IS NULL OR purchased_units > 0),
	CONSTRAINT "store_purchases_quantity_presence" CHECK ((verified_token_quantity IS NULL) = (product_token_quantity IS NULL OR purchased_units IS NULL)),
	CONSTRAINT "store_purchases_exact_quantity" CHECK (verified_token_quantity IS NULL OR (verified_token_quantity > 0 AND verified_token_quantity::numeric = product_token_quantity::numeric * purchased_units)),
	CONSTRAINT "store_purchases_attribution_pair" CHECK ((buyer_account_id IS NULL) = (attributed_at IS NULL)),
	CONSTRAINT "store_purchases_order_buyer" CHECK (intended_order_id IS NULL OR buyer_account_id IS NOT NULL),
	CONSTRAINT "store_purchases_attribution_order" CHECK (attributed_at IS NULL OR attributed_at >= created_at),
	CONSTRAINT "store_purchases_verification_pair" CHECK ((latest_verification_event_id IS NULL) = (last_verified_at IS NULL)),
	CONSTRAINT "store_purchases_verification_order" CHECK (last_verified_at IS NULL OR last_verified_at >= created_at),
	CONSTRAINT "store_purchases_verified_price_presence" CHECK (price_amount IS NULL OR (price_amount >= 0 AND price_currency IS NOT NULL)),
	CONSTRAINT "store_purchases_currency_shape" CHECK (price_currency IS NULL OR price_currency ~ '^[A-Z]{3}$'),
	CONSTRAINT "store_purchases_offer_object" CHECK (jsonb_typeof(verified_offer_details) = 'object'),
	CONSTRAINT "store_purchases_completion_order" CHECK (completion_requested_at IS NULL OR completion_requested_at >= created_at),
	CONSTRAINT "store_purchases_completion_shape" CHECK ((completion_state = 'not_required' AND completion_requested_at IS NULL AND completed_at IS NULL) OR (completion_state = 'pending' AND completion_requested_at IS NOT NULL AND completed_at IS NULL) OR (completion_state = 'completed' AND completion_requested_at IS NOT NULL AND completed_at IS NOT NULL AND completed_at >= completion_requested_at))
);
--> statement-breakpoint
CREATE TABLE "staff_accounts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"role" "staff_role" NOT NULL,
	"normalized_email" text NOT NULL,
	"password_hash" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_accounts_normalized_email_unique" UNIQUE("normalized_email"),
	CONSTRAINT "staff_accounts_normalized_email" CHECK (length(btrim(normalized_email)) > 0 AND normalized_email = lower(btrim(normalized_email))),
	CONSTRAINT "staff_accounts_password_hash_present" CHECK (length(btrim(password_hash)) > 0)
);
--> statement-breakpoint
CREATE TABLE "staff_audit_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"staff_account_id" uuid NOT NULL,
	"action_code" varchar(80) NOT NULL,
	"target_kind" varchar(48) NOT NULL,
	"target_key" varchar(160) NOT NULL,
	"request_key" uuid NOT NULL,
	"reason" text,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_audit_events_request_key_unique" UNIQUE("request_key"),
	CONSTRAINT "staff_audit_events_details_object" CHECK (details IS NULL OR jsonb_typeof(details) = 'object'),
	CONSTRAINT "staff_audit_events_nonblank_target_action" CHECK (length(btrim(action_code)) > 0 AND length(btrim(target_kind)) > 0 AND length(btrim(target_key)) > 0)
);
--> statement-breakpoint
CREATE TABLE "staff_sessions" (
	"session_hash" "bytea" PRIMARY KEY NOT NULL,
	"staff_account_id" uuid NOT NULL,
	"session_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "staff_sessions_hash_shape" CHECK (octet_length(session_hash) = 32),
	CONSTRAINT "staff_sessions_data_object" CHECK (jsonb_typeof(session_data) = 'object'),
	CONSTRAINT "staff_sessions_expiry_order" CHECK (expires_at > created_at),
	CONSTRAINT "staff_sessions_revocation_order" CHECK (revoked_at IS NULL OR revoked_at >= created_at)
);
--> statement-breakpoint
CREATE TABLE "contact_submissions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"request_key" uuid NOT NULL,
	"request_digest" "bytea" NOT NULL,
	"account_id" uuid,
	"kind" "contact_kind" NOT NULL,
	"support_reason" varchar(24),
	"business_kind" varchar(24),
	"name" text,
	"email" text,
	"handle" text,
	"message" text,
	"rating" smallint,
	"state" "contact_state" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"closed_at" timestamp with time zone,
	"closed_by_staff_id" uuid,
	CONSTRAINT "contact_submissions_request_key_unique" UNIQUE("request_key"),
	CONSTRAINT "contact_submissions_request_digest" CHECK (octet_length(request_digest) = 32),
	CONSTRAINT "contact_submissions_message_bounds" CHECK (message IS NULL OR length(message) <= 1000),
	CONSTRAINT "contact_submissions_rating_bounds" CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
	CONSTRAINT "contact_submissions_form_shape" CHECK ((kind = 'support' AND support_reason IS NOT NULL AND support_reason IN ('technical', 'purchase', 'account') AND business_kind IS NULL AND email IS NOT NULL AND message IS NOT NULL AND length(btrim(message)) >= 5 AND rating IS NULL) OR (kind = 'business' AND business_kind IS NOT NULL AND business_kind IN ('business', 'influencer') AND support_reason IS NULL AND email IS NOT NULL AND message IS NOT NULL AND length(btrim(message)) >= 5 AND rating IS NULL) OR (kind = 'experience' AND support_reason IS NULL AND business_kind IS NULL AND (rating IS NOT NULL OR (message IS NOT NULL AND length(btrim(message)) > 0)))),
	CONSTRAINT "contact_submissions_closed_time" CHECK ((state = 'closed') = (closed_at IS NOT NULL)),
	CONSTRAINT "contact_submissions_closing_actor" CHECK ((closed_at IS NULL) = (closed_by_staff_id IS NULL)),
	CONSTRAINT "contact_submissions_closing_order" CHECK (closed_at IS NULL OR closed_at >= created_at)
);
--> statement-breakpoint
CREATE TABLE "public_page_media" (
	"page_id" uuid NOT NULL,
	"slot_key" varchar(80) NOT NULL,
	"media_asset_id" uuid NOT NULL,
	"alt_ar" text,
	"alt_franco" text,
	CONSTRAINT "public_page_media_pkey" PRIMARY KEY("page_id","slot_key"),
	CONSTRAINT "public_page_media_nonblank_slot" CHECK (length(btrim(slot_key)) > 0)
);
--> statement-breakpoint
CREATE TABLE "public_pages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" varchar(80) NOT NULL,
	"content_schema_version" smallint DEFAULT 1 NOT NULL,
	"content" jsonb NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"updated_by_staff_id" uuid NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "public_pages_slug_unique" UNIQUE("slug"),
	CONSTRAINT "public_pages_slug_shape" CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "public_pages_content_shape" CHECK (content_schema_version > 0 AND jsonb_typeof(content) = 'object')
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"settings_schema_version" smallint DEFAULT 1 NOT NULL,
	"logo_asset_id" uuid,
	"branding" jsonb NOT NULL,
	"updated_by_staff_id" uuid NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "site_settings_singleton_version" CHECK (id = 1 AND settings_schema_version > 0),
	CONSTRAINT "site_settings_branding_object" CHECK (jsonb_typeof(branding) = 'object')
);
--> statement-breakpoint
CREATE TABLE "outbox_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"deduplication_key" varchar(160) NOT NULL,
	"topic" varchar(80) NOT NULL,
	"resource_kind" varchar(48) NOT NULL,
	"resource_id" uuid NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"state" "work_state" DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"max_attempts" smallint DEFAULT 10 NOT NULL,
	"available_at" timestamp with time zone NOT NULL,
	"lease_token" uuid,
	"lease_until" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"last_error_code" varchar(80),
	CONSTRAINT "outbox_events_deduplication_key_unique" UNIQUE("deduplication_key"),
	CONSTRAINT "outbox_events_nonblank_routing" CHECK (length(btrim(topic)) > 0 AND length(btrim(resource_kind)) > 0),
	CONSTRAINT "outbox_events_payload_object" CHECK (jsonb_typeof(payload) = 'object'),
	CONSTRAINT "outbox_events_attempt_bounds" CHECK (max_attempts > 0 AND attempt_count BETWEEN 0 AND max_attempts),
	CONSTRAINT "outbox_events_lease_token_pair" CHECK ((state = 'running') = (lease_token IS NOT NULL)),
	CONSTRAINT "outbox_events_lease_time_pair" CHECK ((lease_token IS NULL) = (lease_until IS NULL)),
	CONSTRAINT "outbox_events_claim_attempt" CHECK (state <> 'running' OR attempt_count > 0),
	CONSTRAINT "outbox_events_finish_pair" CHECK ((state IN ('succeeded', 'dead')) = (finished_at IS NOT NULL)),
	CONSTRAINT "outbox_events_finish_order" CHECK (finished_at IS NULL OR finished_at >= created_at)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "account_deletion_requests_account_identity" ON "account_deletion_requests" USING btree ("id","account_id");--> statement-breakpoint
CREATE INDEX "account_deletion_requests_account_history" ON "account_deletion_requests" USING btree ("account_id","requested_at","id");--> statement-breakpoint
CREATE INDEX "account_deletion_requests_pending_work" ON "account_deletion_requests" USING btree ("state","requested_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "account_deletion_requests_one_open_account" ON "account_deletion_requests" USING btree ("account_id") WHERE state IN ('requested', 'confirmed');--> statement-breakpoint
CREATE INDEX "account_phone_changes_account_history" ON "account_phone_changes" USING btree ("account_id","changed_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_firebase_identity" ON "accounts" USING btree ("firebase_project_id","firebase_uid");--> statement-breakpoint
CREATE INDEX "accounts_active_game_release" ON "accounts" USING btree ("active_game_id","id") WHERE active_game_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "phone_verification_challenges_cleanup" ON "phone_verification_challenges" USING btree ("expires_at","id");--> statement-breakpoint
CREATE INDEX "phone_verification_challenges_phone_history" ON "phone_verification_challenges" USING btree ("phone_e164","created_at","id") WHERE phone_e164 IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "media_assets_storage_identity" ON "media_assets" USING btree ("storage_provider","storage_namespace","storage_key");--> statement-breakpoint
CREATE INDEX "media_assets_derivatives" ON "media_assets" USING btree ("source_asset_id","id");--> statement-breakpoint
CREATE INDEX "question_media_asset_references" ON "question_media" USING btree ("media_asset_id","question_id");--> statement-breakpoint
CREATE UNIQUE INDEX "question_packs_category_number" ON "question_packs" USING btree ("category_id","pack_number");--> statement-breakpoint
CREATE UNIQUE INDEX "questions_one_current_per_pack_slot" ON "questions" USING btree ("pack_id","slot_number") WHERE retired_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "room_memberships_room_identity" ON "room_memberships" USING btree ("room_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "room_memberships_one_active_account" ON "room_memberships" USING btree ("room_id","account_id") WHERE account_id IS NOT NULL AND left_at IS NULL AND removed_at IS NULL;--> statement-breakpoint
CREATE INDEX "room_memberships_account_recovery" ON "room_memberships" USING btree ("account_id","room_id") WHERE account_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "rooms_owner_identity" ON "rooms" USING btree ("id","owner_account_id");--> statement-breakpoint
CREATE INDEX "rooms_expired_code_cleanup" ON "rooms" USING btree ("invitation_expires_at","id") WHERE invitation_code IS NOT NULL;--> statement-breakpoint
CREATE INDEX "game_actions_version_history" ON "game_actions" USING btree ("game_id","result_version","command_id");--> statement-breakpoint
CREATE UNIQUE INDEX "game_actions_question_award" ON "game_actions" USING btree ("game_id","score_source_board_position","score_source_question_position");--> statement-breakpoint
CREATE UNIQUE INDEX "game_actions_one_score_effect_per_version" ON "game_actions" USING btree ("game_id","result_version") WHERE score_entry_kind IS NOT NULL;--> statement-breakpoint
CREATE INDEX "game_actions_receipt_cleanup" ON "game_actions" USING btree ("accepted_at","game_id") WHERE score_entry_kind IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "game_packs_distinct_categories" ON "game_packs" USING btree ("game_id","category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "game_players_account" ON "game_players" USING btree ("game_id","account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "game_players_room_member" ON "game_players" USING btree ("game_id","room_member_id");--> statement-breakpoint
CREATE INDEX "game_players_account_history" ON "game_players" USING btree ("account_id","joined_at","game_id");--> statement-breakpoint
CREATE INDEX "game_question_media_asset_references" ON "game_question_media" USING btree ("media_asset_id","game_id");--> statement-breakpoint
CREATE UNIQUE INDEX "game_questions_distinct_question" ON "game_questions" USING btree ("game_id","source_question_id");--> statement-breakpoint
CREATE UNIQUE INDEX "game_questions_resolution_command" ON "game_questions" USING btree ("game_id","resolution_command_id");--> statement-breakpoint
CREATE INDEX "game_questions_source_history" ON "game_questions" USING btree ("source_question_id","game_id");--> statement-breakpoint
CREATE INDEX "game_questions_feedback_recent" ON "game_questions" USING btree ("feedback_vote","feedback_updated_at","game_id") WHERE feedback_vote IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "games_room_membership_identity" ON "games" USING btree ("id","room_id");--> statement-breakpoint
CREATE UNIQUE INDEX "games_room_sequence" ON "games" USING btree ("room_id","sequence_number");--> statement-breakpoint
CREATE UNIQUE INDEX "games_host_identity" ON "games" USING btree ("id","host_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "games_one_active_per_room" ON "games" USING btree ("room_id") WHERE status = 'active';--> statement-breakpoint
CREATE INDEX "games_due_expiry" ON "games" USING btree ("idle_expires_at","id") WHERE status = 'active';--> statement-breakpoint
CREATE INDEX "games_due_content_purge" ON "games" USING btree ("content_purge_after","id") WHERE content_purged_at IS NULL AND content_purge_after IS NOT NULL;--> statement-breakpoint
CREATE INDEX "promo_usages_global_counts" ON "promo_usages" USING btree ("promotion_id","state");--> statement-breakpoint
CREATE INDEX "promo_usages_buyer_counts" ON "promo_usages" USING btree ("promotion_id","buyer_account_id","state");--> statement-breakpoint
CREATE INDEX "promo_usages_phone_allowance" ON "promo_usages" USING btree ("promotion_id","buyer_phone_fingerprint","state") WHERE buyer_phone_fingerprint IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "promotions_fingerprint_key_identity" ON "promotions" USING btree ("id","phone_fingerprint_key_version");--> statement-breakpoint
CREATE UNIQUE INDEX "promotions_trigger_identity" ON "promotions" USING btree ("id","trigger");--> statement-breakpoint
CREATE UNIQUE INDEX "token_ledger_entries_game_effect" ON "token_ledger_entries" USING btree ("game_id","entry_kind");--> statement-breakpoint
CREATE UNIQUE INDEX "token_ledger_entries_typed_source" ON "token_ledger_entries" USING btree ("account_id","game_id","id","entry_kind");--> statement-breakpoint
CREATE INDEX "token_ledger_entries_account_history" ON "token_ledger_entries" USING btree ("account_id","created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "token_orders_buyer_request" ON "token_orders" USING btree ("buyer_account_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "token_orders_buyer_history" ON "token_orders" USING btree ("buyer_account_id","created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "token_orders_promo_identity" ON "token_orders" USING btree ("id","buyer_account_id","applied_promotion_id");--> statement-breakpoint
CREATE UNIQUE INDEX "token_orders_credit_source_identity" ON "token_orders" USING btree ("id","beneficiary_account_id","token_quantity","settlement_kind");--> statement-breakpoint
CREATE INDEX "token_orders_gift_claim_lookup" ON "token_orders" USING btree ("recipient_phone_e164","id");--> statement-breakpoint
CREATE INDEX "token_orders_beneficiary_history" ON "token_orders" USING btree ("beneficiary_account_id","created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "token_orders_buyer_identity" ON "token_orders" USING btree ("id","buyer_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_attempts_order_request" ON "payment_attempts" USING btree ("order_id","request_key");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_attempts_financial_identity" ON "payment_attempts" USING btree ("id","order_id","provider","environment","provider_namespace");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_attempts_correlation_reference" ON "payment_attempts" USING btree ("provider","environment","provider_namespace","special_reference");--> statement-breakpoint
CREATE INDEX "payment_attempts_order_history" ON "payment_attempts" USING btree ("order_id","created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_events_exact_delivery" ON "payment_events" USING btree ("provider","environment","provider_namespace","fingerprint");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_events_transaction_identity" ON "payment_events" USING btree ("id","transaction_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_events_attempt_identity" ON "payment_events" USING btree ("id","attempt_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_events_native_purchase_identity" ON "payment_events" USING btree ("id","native_purchase_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_events_native_delivery_identity" ON "payment_events" USING btree ("provider","environment","provider_namespace","native_notification_id");--> statement-breakpoint
CREATE INDEX "payment_events_pending_work" ON "payment_events" USING btree ("state","received_at","id") WHERE state IN ('queued', 'needs_review');--> statement-breakpoint
CREATE INDEX "payment_events_attempt_history" ON "payment_events" USING btree ("attempt_id","verified_at","id") WHERE attempt_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "payment_events_native_history" ON "payment_events" USING btree ("native_purchase_id","verified_at","id") WHERE native_purchase_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "payment_provider_references_attempt_lookup" ON "payment_provider_references" USING btree ("attempt_id","reference_kind");--> statement-breakpoint
CREATE INDEX "payment_reconciliation_cases_staff_queue" ON "payment_reconciliation_cases" USING btree ("state","opened_at","id");--> statement-breakpoint
CREATE INDEX "payment_reconciliation_cases_order_history" ON "payment_reconciliation_cases" USING btree ("order_id","opened_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_transactions_provider_identity" ON "payment_transactions" USING btree ("provider","environment","provider_namespace","provider_transaction_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_transactions_order_identity" ON "payment_transactions" USING btree ("id","order_id","transaction_kind");--> statement-breakpoint
CREATE INDEX "payment_transactions_order_history" ON "payment_transactions" USING btree ("order_id","created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "store_products_external_identity" ON "store_products" USING btree ("provider","application_id","provider_product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "store_products_purchase_mapping" ON "store_products" USING btree ("id","provider","application_id","provider_product_id","token_quantity");--> statement-breakpoint
CREATE UNIQUE INDEX "store_products_order_mapping" ON "store_products" USING btree ("id","provider","token_quantity");--> statement-breakpoint
CREATE UNIQUE INDEX "store_purchases_transaction_identity" ON "store_purchases" USING btree ("provider","environment","application_id","store_transaction_id");--> statement-breakpoint
CREATE UNIQUE INDEX "store_purchases_event_namespace" ON "store_purchases" USING btree ("id","provider","environment","application_id");--> statement-breakpoint
CREATE UNIQUE INDEX "store_purchases_fulfillment_identity" ON "store_purchases" USING btree ("id","intended_order_id","buyer_account_id","verified_token_quantity","provider","store_product_id");--> statement-breakpoint
CREATE INDEX "store_purchases_account_history" ON "store_purchases" USING btree ("buyer_account_id","created_at","id");--> statement-breakpoint
CREATE INDEX "store_purchases_order_lookup" ON "store_purchases" USING btree ("intended_order_id","id");--> statement-breakpoint
CREATE INDEX "staff_audit_events_actor_history" ON "staff_audit_events" USING btree ("staff_account_id","created_at","id");--> statement-breakpoint
CREATE INDEX "staff_audit_events_target_history" ON "staff_audit_events" USING btree ("target_kind","target_key","created_at","id");--> statement-breakpoint
CREATE INDEX "staff_sessions_account_revocation" ON "staff_sessions" USING btree ("staff_account_id","expires_at");--> statement-breakpoint
CREATE INDEX "staff_sessions_expiry_cleanup" ON "staff_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "contact_submissions_staff_inbox" ON "contact_submissions" USING btree ("state","created_at","id");--> statement-breakpoint
CREATE INDEX "contact_submissions_account_cleanup" ON "contact_submissions" USING btree ("account_id","created_at","id");--> statement-breakpoint
CREATE INDEX "public_page_media_asset_references" ON "public_page_media" USING btree ("media_asset_id","page_id");--> statement-breakpoint
CREATE INDEX "outbox_events_resource_history" ON "outbox_events" USING btree ("resource_kind","resource_id","created_at","id");--> statement-breakpoint
CREATE INDEX "outbox_events_pending_work" ON "outbox_events" USING btree ("available_at","id") WHERE state = 'pending';--> statement-breakpoint
CREATE INDEX "outbox_events_stale_leases" ON "outbox_events" USING btree ("lease_until","id") WHERE state = 'running';--> statement-breakpoint
ALTER TABLE "account_deletion_requests" ADD CONSTRAINT "account_deletion_requests_account" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_deletion_requests" ADD CONSTRAINT "deletion_funding_review" FOREIGN KEY ("funding_review_audit_event_id") REFERENCES "public"."staff_audit_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_phone_changes" ADD CONSTRAINT "account_phone_changes_account" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_phone_changes" ADD CONSTRAINT "account_phone_changes_old_proof" FOREIGN KEY ("old_phone_challenge_id") REFERENCES "public"."phone_verification_challenges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_phone_changes" ADD CONSTRAINT "account_phone_changes_new_proof" FOREIGN KEY ("new_phone_challenge_id") REFERENCES "public"."phone_verification_challenges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_phone_changes" ADD CONSTRAINT "account_phone_changes_support_audit" FOREIGN KEY ("support_audit_event_id") REFERENCES "public"."staff_audit_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_active_roster" FOREIGN KEY ("active_game_id","id") REFERENCES "public"."game_players"("game_id","account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phone_verification_challenges" ADD CONSTRAINT "phone_verification_challenges_account" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_source" FOREIGN KEY ("source_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_staff" FOREIGN KEY ("uploaded_by_staff_id") REFERENCES "public"."staff_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_media" ADD CONSTRAINT "question_media_question" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_media" ADD CONSTRAINT "question_media_asset" FOREIGN KEY ("media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_packs" ADD CONSTRAINT "packs_category" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_pack" FOREIGN KEY ("pack_id") REFERENCES "public"."question_packs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_memberships" ADD CONSTRAINT "room_memberships_room" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_memberships" ADD CONSTRAINT "room_memberships_account" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_memberships" ADD CONSTRAINT "room_memberships_unblock_host" FOREIGN KEY ("room_id","removal_lifted_by_account_id") REFERENCES "public"."rooms"("id","owner_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_owner" FOREIGN KEY ("owner_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_current_game" FOREIGN KEY ("current_game_id","id") REFERENCES "public"."games"("id","room_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_actions" ADD CONSTRAINT "game_actions_host" FOREIGN KEY ("game_id","host_account_id") REFERENCES "public"."games"("id","host_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_actions" ADD CONSTRAINT "game_actions_award_question" FOREIGN KEY ("game_id","score_source_board_position","score_source_question_position") REFERENCES "public"."game_questions"("game_id","board_position","question_position") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_packs" ADD CONSTRAINT "game_packs_game" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_packs" ADD CONSTRAINT "game_packs_category" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_packs" ADD CONSTRAINT "game_packs_source" FOREIGN KEY ("pack_id") REFERENCES "public"."question_packs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_packs" ADD CONSTRAINT "game_packs_repeat_actor" FOREIGN KEY ("game_id","repeat_accepted_by_seat") REFERENCES "public"."game_players"("game_id","seat_number") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_players" ADD CONSTRAINT "game_players_room_membership" FOREIGN KEY ("room_id","room_member_id") REFERENCES "public"."room_memberships"("room_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_players" ADD CONSTRAINT "game_players_game_room" FOREIGN KEY ("game_id","room_id") REFERENCES "public"."games"("id","room_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_players" ADD CONSTRAINT "game_players_account" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_question_media" ADD CONSTRAINT "game_question_media_asset" FOREIGN KEY ("media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_question_media" ADD CONSTRAINT "game_question_media_question" FOREIGN KEY ("game_id","board_position","question_position") REFERENCES "public"."game_questions"("game_id","board_position","question_position") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_questions" ADD CONSTRAINT "game_questions_pack" FOREIGN KEY ("game_id","board_position") REFERENCES "public"."game_packs"("game_id","board_position") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_questions" ADD CONSTRAINT "game_questions_source" FOREIGN KEY ("source_question_id") REFERENCES "public"."questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_questions" ADD CONSTRAINT "game_questions_resolution_host" FOREIGN KEY ("game_id","resolved_by_account_id") REFERENCES "public"."games"("id","host_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_questions" ADD CONSTRAINT "game_questions_feedback_host" FOREIGN KEY ("game_id","feedback_by_account_id") REFERENCES "public"."games"("id","host_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_room_owner" FOREIGN KEY ("room_id","host_account_id") REFERENCES "public"."rooms"("id","owner_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_current_question" FOREIGN KEY ("id","active_board_position","active_question_position") REFERENCES "public"."game_questions"("game_id","board_position","question_position") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_pack_completions" ADD CONSTRAINT "completion_membership" FOREIGN KEY ("game_id","account_id") REFERENCES "public"."game_players"("game_id","account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_pack_completions" ADD CONSTRAINT "completion_game_pack" FOREIGN KEY ("game_id","board_position") REFERENCES "public"."game_packs"("game_id","board_position") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_question_exposures" ADD CONSTRAINT "exposure_account" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_question_exposures" ADD CONSTRAINT "exposure_question" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_question_exposures" ADD CONSTRAINT "exposure_first_membership" FOREIGN KEY ("first_game_id","account_id") REFERENCES "public"."game_players"("game_id","account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promo_usages" ADD CONSTRAINT "promo_usages_order_identity" FOREIGN KEY ("order_id","buyer_account_id","promotion_id") REFERENCES "public"."token_orders"("id","buyer_account_id","applied_promotion_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promo_usages" ADD CONSTRAINT "promo_usage_fingerprint_key" FOREIGN KEY ("promotion_id","phone_fingerprint_key_version") REFERENCES "public"."promotions"("id","phone_fingerprint_key_version") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_ledger_entries" ADD CONSTRAINT "token_ledger_restored_debit" FOREIGN KEY ("account_id","game_id","source_debit_id","source_debit_kind") REFERENCES "public"."token_ledger_entries"("account_id","game_id","id","entry_kind") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_ledger_entries" ADD CONSTRAINT "token_ledger_staff_action" FOREIGN KEY ("staff_audit_event_id") REFERENCES "public"."staff_audit_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_ledger_entries" ADD CONSTRAINT "token_ledger_deletion_request" FOREIGN KEY ("deletion_request_id","account_id") REFERENCES "public"."account_deletion_requests"("id","account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_ledger_entries" ADD CONSTRAINT "token_ledger_account" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_ledger_entries" ADD CONSTRAINT "token_ledger_host" FOREIGN KEY ("game_id","account_id") REFERENCES "public"."games"("id","host_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_ledger_entries" ADD CONSTRAINT "token_ledger_order_credit" FOREIGN KEY ("source_order_id","account_id","amount","source_order_settlement_kind") REFERENCES "public"."token_orders"("id","beneficiary_account_id","token_quantity","settlement_kind") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_orders" ADD CONSTRAINT "token_orders_buyer" FOREIGN KEY ("buyer_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_orders" ADD CONSTRAINT "token_orders_beneficiary" FOREIGN KEY ("beneficiary_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_orders" ADD CONSTRAINT "token_orders_promotion" FOREIGN KEY ("applied_promotion_id","applied_promotion_trigger") REFERENCES "public"."promotions"("id","trigger") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_orders" ADD CONSTRAINT "token_orders_settlement_payment" FOREIGN KEY ("settlement_payment_transaction_id","id","settlement_payment_kind") REFERENCES "public"."payment_transactions"("id","order_id","transaction_kind") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_orders" ADD CONSTRAINT "token_orders_settlement_proof" FOREIGN KEY ("settlement_verification_event_id","settlement_payment_transaction_id") REFERENCES "public"."payment_events"("id","transaction_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_orders" ADD CONSTRAINT "native_orders_product" FOREIGN KEY ("store_product_id","purchase_channel","token_quantity") REFERENCES "public"."store_products"("id","provider","token_quantity") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_orders" ADD CONSTRAINT "native_order_purchase" FOREIGN KEY ("settlement_store_purchase_id","id","buyer_account_id","token_quantity","purchase_channel","store_product_id") REFERENCES "public"."store_purchases"("id","intended_order_id","buyer_account_id","verified_token_quantity","provider","store_product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_orders" ADD CONSTRAINT "native_order_proof" FOREIGN KEY ("settlement_verification_event_id","settlement_store_purchase_id") REFERENCES "public"."payment_events"("id","native_purchase_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_order" FOREIGN KEY ("order_id") REFERENCES "public"."token_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_closure_event" FOREIGN KEY ("closure_verification_event_id","id") REFERENCES "public"."payment_events"("id","attempt_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_attempt" FOREIGN KEY ("attempt_id") REFERENCES "public"."payment_attempts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_transaction" FOREIGN KEY ("transaction_id") REFERENCES "public"."payment_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_events" ADD CONSTRAINT "native_event_purchase" FOREIGN KEY ("native_purchase_id","provider","environment","provider_namespace") REFERENCES "public"."store_purchases"("id","provider","environment","application_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_event_origin" FOREIGN KEY ("origin_event_id") REFERENCES "public"."payment_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_provider_references" ADD CONSTRAINT "payment_provider_references_attempt_namespace" FOREIGN KEY ("attempt_id","order_id","provider","environment","provider_namespace") REFERENCES "public"."payment_attempts"("id","order_id","provider","environment","provider_namespace") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_reconciliation_cases" ADD CONSTRAINT "payment_reconciliation_cases_order" FOREIGN KEY ("order_id") REFERENCES "public"."token_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_reconciliation_cases" ADD CONSTRAINT "payment_reconciliation_cases_attempt" FOREIGN KEY ("attempt_id") REFERENCES "public"."payment_attempts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_reconciliation_cases" ADD CONSTRAINT "payment_reconciliation_cases_transaction" FOREIGN KEY ("transaction_id") REFERENCES "public"."payment_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_reconciliation_cases" ADD CONSTRAINT "payment_reconciliation_cases_audit" FOREIGN KEY ("resolution_audit_event_id") REFERENCES "public"."staff_audit_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_reconciliation_cases" ADD CONSTRAINT "payment_cases_event" FOREIGN KEY ("payment_event_id") REFERENCES "public"."payment_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_reconciliation_cases" ADD CONSTRAINT "native_payment_case" FOREIGN KEY ("native_purchase_id") REFERENCES "public"."store_purchases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_parent" FOREIGN KEY ("parent_transaction_id") REFERENCES "public"."payment_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_attempt_namespace" FOREIGN KEY ("attempt_id","order_id","provider","environment","provider_namespace") REFERENCES "public"."payment_attempts"("id","order_id","provider","environment","provider_namespace") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_last_event" FOREIGN KEY ("last_verification_event_id","id") REFERENCES "public"."payment_events"("id","transaction_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_products" ADD CONSTRAINT "store_products_staff" FOREIGN KEY ("updated_by_staff_id") REFERENCES "public"."staff_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_purchases" ADD CONSTRAINT "store_purchases_product" FOREIGN KEY ("store_product_id","provider","application_id","provider_product_id","product_token_quantity") REFERENCES "public"."store_products"("id","provider","application_id","provider_product_id","token_quantity") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_purchases" ADD CONSTRAINT "store_purchases_buyer" FOREIGN KEY ("buyer_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_purchases" ADD CONSTRAINT "store_purchases_order" FOREIGN KEY ("intended_order_id","buyer_account_id") REFERENCES "public"."token_orders"("id","buyer_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_purchases" ADD CONSTRAINT "store_purchases_last_event" FOREIGN KEY ("latest_verification_event_id","id") REFERENCES "public"."payment_events"("id","native_purchase_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_audit_events" ADD CONSTRAINT "staff_audit_events_actor" FOREIGN KEY ("staff_account_id") REFERENCES "public"."staff_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_sessions" ADD CONSTRAINT "staff_sessions_account" FOREIGN KEY ("staff_account_id") REFERENCES "public"."staff_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_submissions" ADD CONSTRAINT "contact_submissions_account" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_submissions" ADD CONSTRAINT "contact_submissions_closing_staff" FOREIGN KEY ("closed_by_staff_id") REFERENCES "public"."staff_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_page_media" ADD CONSTRAINT "public_page_media_page" FOREIGN KEY ("page_id") REFERENCES "public"."public_pages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_page_media" ADD CONSTRAINT "public_page_media_asset" FOREIGN KEY ("media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_pages" ADD CONSTRAINT "public_pages_editor" FOREIGN KEY ("updated_by_staff_id") REFERENCES "public"."staff_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_logo" FOREIGN KEY ("logo_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_editor" FOREIGN KEY ("updated_by_staff_id") REFERENCES "public"."staff_accounts"("id") ON DELETE no action ON UPDATE no action;
