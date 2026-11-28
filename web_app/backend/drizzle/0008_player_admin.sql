CREATE TABLE "account_bans" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"banned_by" uuid NOT NULL,
	"audit_event_id" uuid NOT NULL,
	"banned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lifted_at" timestamp with time zone,
	"lifted_by" uuid,
	"lift_reason" text,
	"lift_audit_event_id" uuid,
	CONSTRAINT "account_bans_audit_event_id_unique" UNIQUE("audit_event_id"),
	CONSTRAINT "account_bans_lift_audit_event_id_unique" UNIQUE("lift_audit_event_id"),
	CONSTRAINT "account_bans_reason_present" CHECK (length(btrim(reason)) > 0),
	CONSTRAINT "account_bans_lift_complete" CHECK ((lifted_at IS NULL) = (lifted_by IS NULL) AND (lifted_at IS NULL) = (lift_reason IS NULL) AND (lifted_at IS NULL) = (lift_audit_event_id IS NULL)),
	CONSTRAINT "account_bans_lift_reason_present" CHECK (lift_reason IS NULL OR length(btrim(lift_reason)) > 0),
	CONSTRAINT "account_bans_lift_order" CHECK (lifted_at IS NULL OR lifted_at >= banned_at)
);
--> statement-breakpoint
CREATE TABLE "account_flags" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"note" text NOT NULL,
	"created_by" uuid NOT NULL,
	"audit_event_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" uuid,
	"resolve_audit_event_id" uuid,
	CONSTRAINT "account_flags_audit_event_id_unique" UNIQUE("audit_event_id"),
	CONSTRAINT "account_flags_resolve_audit_event_id_unique" UNIQUE("resolve_audit_event_id"),
	CONSTRAINT "account_flags_note_present" CHECK (length(btrim(note)) > 0),
	CONSTRAINT "account_flags_resolution_complete" CHECK ((resolved_at IS NULL) = (resolved_by IS NULL) AND (resolved_at IS NULL) = (resolve_audit_event_id IS NULL)),
	CONSTRAINT "account_flags_resolution_order" CHECK (resolved_at IS NULL OR resolved_at >= created_at)
);
--> statement-breakpoint
CREATE TABLE "bulk_grants" (
	"id" uuid PRIMARY KEY NOT NULL,
	"request_key" uuid NOT NULL,
	"audit_event_id" uuid NOT NULL,
	"target_kind" text NOT NULL,
	"target_phones" text[],
	"quantity" integer NOT NULL,
	"reason" text NOT NULL,
	"target_count" integer NOT NULL,
	"granted_count" integer DEFAULT 0 NOT NULL,
	"last_account_id" uuid,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "bulk_grants_request_key_unique" UNIQUE("request_key"),
	CONSTRAINT "bulk_grants_audit_event_id_unique" UNIQUE("audit_event_id"),
	CONSTRAINT "bulk_grants_target" CHECK ((target_kind = 'all_active' AND target_phones IS NULL) OR (target_kind = 'phone_list' AND target_phones IS NOT NULL AND cardinality(target_phones) > 0)),
	CONSTRAINT "bulk_grants_quantity" CHECK (quantity BETWEEN 1 AND 1000),
	CONSTRAINT "bulk_grants_reason_present" CHECK (length(btrim(reason)) > 0),
	CONSTRAINT "bulk_grants_progress" CHECK (target_count >= 0 AND granted_count >= 0)
);
--> statement-breakpoint
ALTER TABLE "token_ledger_entries" DROP CONSTRAINT "token_ledger_entries_staff_audit_event_id_unique";--> statement-breakpoint
ALTER TABLE "account_bans" ADD CONSTRAINT "account_bans_account" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_bans" ADD CONSTRAINT "account_bans_banned_by" FOREIGN KEY ("banned_by") REFERENCES "public"."staff_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_bans" ADD CONSTRAINT "account_bans_audit" FOREIGN KEY ("audit_event_id") REFERENCES "public"."staff_audit_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_bans" ADD CONSTRAINT "account_bans_lifted_by" FOREIGN KEY ("lifted_by") REFERENCES "public"."staff_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_bans" ADD CONSTRAINT "account_bans_lift_audit" FOREIGN KEY ("lift_audit_event_id") REFERENCES "public"."staff_audit_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_flags" ADD CONSTRAINT "account_flags_account" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_flags" ADD CONSTRAINT "account_flags_created_by" FOREIGN KEY ("created_by") REFERENCES "public"."staff_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_flags" ADD CONSTRAINT "account_flags_audit" FOREIGN KEY ("audit_event_id") REFERENCES "public"."staff_audit_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_flags" ADD CONSTRAINT "account_flags_resolved_by" FOREIGN KEY ("resolved_by") REFERENCES "public"."staff_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_flags" ADD CONSTRAINT "account_flags_resolve_audit" FOREIGN KEY ("resolve_audit_event_id") REFERENCES "public"."staff_audit_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulk_grants" ADD CONSTRAINT "bulk_grants_audit" FOREIGN KEY ("audit_event_id") REFERENCES "public"."staff_audit_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulk_grants" ADD CONSTRAINT "bulk_grants_created_by" FOREIGN KEY ("created_by") REFERENCES "public"."staff_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_bans_one_active" ON "account_bans" USING btree ("account_id") WHERE lifted_at IS NULL;--> statement-breakpoint
CREATE INDEX "account_bans_account_history" ON "account_bans" USING btree ("account_id","banned_at","id");--> statement-breakpoint
CREATE INDEX "account_flags_account_history" ON "account_flags" USING btree ("account_id","created_at","id");--> statement-breakpoint
CREATE INDEX "account_flags_open" ON "account_flags" USING btree ("account_id") WHERE resolved_at IS NULL;--> statement-breakpoint
CREATE INDEX "bulk_grants_recent" ON "bulk_grants" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "accounts_recent" ON "accounts" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "accounts_phone_suffix" ON "accounts" USING btree (reverse("phone_e164") text_pattern_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "token_ledger_entries_staff_action_account" ON "token_ledger_entries" USING btree ("staff_audit_event_id","account_id");
--> statement-breakpoint
-- A bulk grant credits many accounts under one audit event (action token_bulk_grant).
CREATE OR REPLACE FUNCTION sahsah_internal.guard_token_source()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE a accounts%ROWTYPE; g games%ROWTYPE; d account_deletion_requests%ROWTYPE;
        audit staff_audit_events%ROWTYPE;
BEGIN
  SELECT * INTO STRICT a FROM accounts WHERE id=NEW.account_id FOR NO KEY UPDATE;
  IF a.state='deleted' THEN
    RAISE EXCEPTION 'deleted account cannot receive a new token movement' USING ERRCODE='23514';
  END IF;
  IF NEW.staff_audit_event_id IS NOT NULL THEN
    SELECT e.* INTO STRICT audit FROM staff_audit_events e JOIN staff_accounts s
      ON s.id=e.staff_account_id WHERE e.id=NEW.staff_audit_event_id AND s.is_active;
    IF audit.reason IS NULL OR length(btrim(audit.reason))=0 OR
       NOT ((NEW.entry_kind='credit' AND audit.action_code='token_grant'
              AND audit.target_kind='account' AND audit.target_key=NEW.account_id::text)
         OR (NEW.entry_kind='credit' AND audit.action_code='token_bulk_grant'
              AND audit.target_kind='bulk_grant')
         OR (NEW.entry_kind='game_restoration' AND audit.action_code='game_token_restoration'
              AND audit.target_kind='game' AND audit.target_key=NEW.game_id::text)) THEN
      RAISE EXCEPTION 'token action requires matching authorized staff audit and reason'
        USING ERRCODE='23514';
    END IF;
  END IF;
  IF NEW.entry_kind='credit' AND NEW.staff_audit_event_id IS NOT NULL AND a.state<>'active' THEN
    RAISE EXCEPTION 'new complimentary credit requires an active account' USING ERRCODE='23514';
  ELSIF NEW.entry_kind='game_debit' THEN
    SELECT * INTO STRICT g FROM games WHERE id=NEW.game_id;
    IF g.status<>'active' OR a.active_game_id IS DISTINCT FROM g.id OR a.state<>'active' THEN
      RAISE EXCEPTION 'game debit requires the accepted active-game claim' USING ERRCODE='23514';
    END IF;
  ELSIF NEW.entry_kind='game_restoration' THEN
    SELECT * INTO STRICT g FROM games WHERE id=NEW.game_id;
    IF g.status='active' OR (NEW.restoration_reason='unopened_game' AND g.first_question_opened_at IS NOT NULL)
       OR (NEW.restoration_reason='platform_failure' AND g.end_reason IS DISTINCT FROM 'platform_failure') THEN
      RAISE EXCEPTION 'game token restoration is not eligible' USING ERRCODE='23514';
    END IF;
  ELSIF NEW.entry_kind='deletion_forfeiture' THEN
    SELECT * INTO STRICT d FROM account_deletion_requests WHERE id=NEW.deletion_request_id;
    IF a.state<>'deletion_pending' OR d.state<>'confirmed' OR d.confirmed_bank<>a.token_balance
       OR NEW.amount<>-a.token_balance OR d.funding_cleared_at IS NULL THEN
      RAISE EXCEPTION 'deletion must forfeit the exact confirmed bank after funding clearance'
        USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
