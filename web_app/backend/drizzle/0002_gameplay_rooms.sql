CREATE TABLE "room_actions" (
	"operation_id" uuid PRIMARY KEY NOT NULL,
	"room_id" uuid NOT NULL,
	"actor_account_id" uuid,
	"actor_membership_id" uuid,
	"actor_proof_hash" "bytea",
	"operation_name" varchar(64) NOT NULL,
	"request_digest" "bytea" NOT NULL,
	"result_data" jsonb NOT NULL,
	"accepted_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "room_action_shape" CHECK (octet_length(request_digest)=32 AND length(btrim(operation_name))>0 AND jsonb_typeof(result_data)='object' AND pg_column_size(result_data)<=8192 AND expires_at>=accepted_at + interval '7 days' AND (actor_account_id IS NOT NULL OR actor_membership_id IS NOT NULL) AND (actor_proof_hash IS NULL OR octet_length(actor_proof_hash)=32))
);
--> statement-breakpoint
CREATE TABLE "room_pack_selections" (
	"room_id" uuid NOT NULL,
	"board_position" smallint NOT NULL,
	"category_id" uuid NOT NULL,
	"pack_id" uuid NOT NULL,
	"observed_revision" bigint NOT NULL,
	"repeat_consent_basis" "bytea",
	"repeat_accepted_at" timestamp with time zone,
	CONSTRAINT "room_pack_selections_pkey" PRIMARY KEY("room_id","board_position"),
	CONSTRAINT "room_selection_shape" CHECK (board_position BETWEEN 1 AND 6 AND observed_revision > 0 AND ((repeat_consent_basis IS NULL AND repeat_accepted_at IS NULL) OR (octet_length(repeat_consent_basis)=32 AND repeat_accepted_at IS NOT NULL)))
);
--> statement-breakpoint
ALTER TABLE "room_memberships" ADD COLUMN "state_version" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "room_memberships" ADD COLUMN "join_request_id" uuid;--> statement-breakpoint
ALTER TABLE "room_memberships" ADD COLUMN "join_request_digest" "bytea";--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "state_version" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "presentation_mode" text DEFAULT 'lobby' NOT NULL;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "create_request_id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "create_request_digest" "bytea" DEFAULT sha256(gen_random_uuid()::text::bytea) NOT NULL;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "controller_generation" bigint DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "controller_credential_hash" "bytea" DEFAULT sha256((gen_random_uuid()::text || gen_random_uuid()::text)::bytea) NOT NULL;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "controller_acquired_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "last_lobby_activity_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "lobby_idle_expires_at" timestamp with time zone DEFAULT now() + interval '24 hours' NOT NULL;--> statement-breakpoint
ALTER TABLE "game_questions" ADD COLUMN "feedback_version" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "projection_version" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "room_actions" ADD CONSTRAINT "room_action_room" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_actions" ADD CONSTRAINT "room_action_account" FOREIGN KEY ("actor_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_actions" ADD CONSTRAINT "room_action_membership" FOREIGN KEY ("room_id","actor_membership_id") REFERENCES "public"."room_memberships"("room_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_pack_selections" ADD CONSTRAINT "room_selection_room" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_pack_selections" ADD CONSTRAINT "room_selection_category" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_pack_selections" ADD CONSTRAINT "room_selection_pack" FOREIGN KEY ("pack_id") REFERENCES "public"."question_packs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "room_actions_cleanup" ON "room_actions" USING btree ("expires_at","operation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "room_pack_selections_category" ON "room_pack_selections" USING btree ("room_id","category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rooms_one_open_owner" ON "rooms" USING btree ("owner_account_id") WHERE closed_at IS NULL;--> statement-breakpoint
CREATE INDEX "rooms_lobby_expiry" ON "rooms" USING btree ("lobby_idle_expires_at","id") WHERE closed_at IS NULL;--> statement-breakpoint
ALTER TABLE "room_memberships" ADD CONSTRAINT "room_memberships_join_request_id_unique" UNIQUE("join_request_id");--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_create_request_id_unique" UNIQUE("create_request_id");--> statement-breakpoint
ALTER TABLE "room_memberships" ADD CONSTRAINT "room_memberships_revision" CHECK (state_version >= 0 AND ((join_request_id IS NULL AND join_request_digest IS NULL) OR (join_request_id IS NOT NULL AND octet_length(join_request_digest)=32)));--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_state_version" CHECK (state_version >= 0 AND presentation_mode IN ('lobby','game'));--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_control_shape" CHECK (controller_generation > 0 AND octet_length(controller_credential_hash)=32 AND octet_length(create_request_digest)=32);--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_lobby_window" CHECK (lobby_idle_expires_at = last_lobby_activity_at + interval '24 hours');