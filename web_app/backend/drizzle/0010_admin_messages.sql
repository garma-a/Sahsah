CREATE TABLE "contact_replies" (
	"id" uuid PRIMARY KEY NOT NULL,
	"contact_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"request_key" uuid NOT NULL,
	"audit_event_id" uuid NOT NULL,
	"body" text NOT NULL,
	"status" varchar(16) NOT NULL,
	"provider_message_id" text,
	"error_code" varchar(40),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "contact_replies_request_key_unique" UNIQUE("request_key"),
	CONSTRAINT "contact_replies_audit_event_id_unique" UNIQUE("audit_event_id"),
	CONSTRAINT "contact_replies_body_bounds" CHECK (length(btrim(body)) > 0 AND length(body) <= 5000),
	CONSTRAINT "contact_replies_status" CHECK (status IN ('sending', 'sent', 'failed', 'external')),
	CONSTRAINT "contact_replies_completion" CHECK ((status = 'sending') = (completed_at IS NULL)),
	CONSTRAINT "contact_replies_outcome" CHECK ((status = 'failed') = (error_code IS NOT NULL) AND (provider_message_id IS NULL OR status = 'sent'))
);
--> statement-breakpoint
ALTER TABLE "contact_replies" ADD CONSTRAINT "contact_replies_contact" FOREIGN KEY ("contact_id") REFERENCES "public"."contact_submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_replies" ADD CONSTRAINT "contact_replies_staff" FOREIGN KEY ("staff_id") REFERENCES "public"."staff_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_replies" ADD CONSTRAINT "contact_replies_audit" FOREIGN KEY ("audit_event_id") REFERENCES "public"."staff_audit_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contact_replies_thread" ON "contact_replies" USING btree ("contact_id","created_at","id");--> statement-breakpoint
CREATE INDEX "contact_submissions_recent" ON "contact_submissions" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "contact_submissions_kind_recent" ON "contact_submissions" USING btree ("kind","created_at","id");--> statement-breakpoint
CREATE INDEX "contact_submissions_kind_state_recent" ON "contact_submissions" USING btree ("kind","state","created_at","id");