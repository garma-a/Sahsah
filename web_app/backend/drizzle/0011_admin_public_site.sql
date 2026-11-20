CREATE TABLE "announcements" (
	"id" uuid PRIMARY KEY NOT NULL,
	"title_ar" text NOT NULL,
	"title_franco" text,
	"body_ar" text NOT NULL,
	"body_franco" text,
	"link_label" text,
	"link_url" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"ever_live" boolean DEFAULT false NOT NULL,
	"created_by_staff_id" uuid NOT NULL,
	"updated_by_staff_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "announcements_text_bounds" CHECK (length(btrim(title_ar)) BETWEEN 1 AND 120 AND length(btrim(body_ar)) BETWEEN 1 AND 500 AND (title_franco IS NULL OR length(btrim(title_franco)) BETWEEN 1 AND 120) AND (body_franco IS NULL OR length(btrim(body_franco)) BETWEEN 1 AND 500)),
	CONSTRAINT "announcements_link_pair" CHECK ((link_label IS NULL) = (link_url IS NULL)),
	CONSTRAINT "announcements_link_shape" CHECK (link_url IS NULL OR (length(link_url) <= 500 AND link_url ~ '^(https://[^[:space:]]+|/([^/[:space:]][^[:space:]]*)?)$' AND strpos(link_url, chr(92)) = 0 AND length(btrim(link_label)) BETWEEN 1 AND 60)),
	CONSTRAINT "announcements_window" CHECK (ends_at IS NULL OR ends_at > starts_at)
);
--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_creator" FOREIGN KEY ("created_by_staff_id") REFERENCES "public"."staff_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_editor" FOREIGN KEY ("updated_by_staff_id") REFERENCES "public"."staff_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "announcements_recent" ON "announcements" USING btree ("starts_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "announcements_live" ON "announcements" USING btree ("starts_at" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE is_active;