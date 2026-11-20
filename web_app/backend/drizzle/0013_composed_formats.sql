ALTER TYPE "public"."question_format" ADD VALUE 'COMPOSED';--> statement-breakpoint
ALTER TYPE "public"."question_media_role" ADD VALUE 'hint_audio';--> statement-breakpoint
CREATE TABLE "question_formats" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name_en" text NOT NULL,
	"label_ar" text NOT NULL,
	"base_kind" text NOT NULL,
	"stage_kinds" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"answer_kind" text DEFAULT 'none' NOT NULL,
	"show_prompt" boolean DEFAULT true NOT NULL,
	"created_by_staff_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "question_formats_code_shape" CHECK (code ~ '^[a-z][a-z0-9_]{1,39}$'),
	CONSTRAINT "question_formats_name_bounds" CHECK (length(btrim(name_en)) BETWEEN 1 AND 80 AND length(btrim(label_ar)) BETWEEN 1 AND 80),
	CONSTRAINT "question_formats_base_kind" CHECK (base_kind IN ('text', 'image', 'audio')),
	CONSTRAINT "question_formats_answer_kind" CHECK (answer_kind IN ('none', 'image', 'audio')),
	CONSTRAINT "question_formats_stage_kinds" CHECK (jsonb_typeof(stage_kinds) = 'array' AND jsonb_array_length(stage_kinds) <= 3 AND NOT jsonb_path_exists(stage_kinds, '$[*] ? (@ != "image" && @ != "audio")')),
	CONSTRAINT "question_formats_update_order" CHECK (updated_at >= created_at)
);
--> statement-breakpoint
ALTER TABLE "question_media" DROP CONSTRAINT "question_media_variant_shape";--> statement-breakpoint
ALTER TABLE "game_question_media" DROP CONSTRAINT "game_question_media_variant_role";--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "composed_format_id" uuid;--> statement-breakpoint
ALTER TABLE "question_formats" ADD CONSTRAINT "question_formats_creator" FOREIGN KEY ("created_by_staff_id") REFERENCES "public"."staff_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "question_formats_code" ON "question_formats" USING btree ("code");--> statement-breakpoint
CREATE INDEX "question_formats_active" ON "question_formats" USING btree ("name_en","id") WHERE archived_at IS NULL;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_composed_format" FOREIGN KEY ("composed_format_id") REFERENCES "public"."question_formats"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "questions_composed_format" ON "questions" USING btree ("composed_format_id","id") WHERE composed_format_id IS NOT NULL;--> statement-breakpoint
ALTER TABLE "question_media" ADD CONSTRAINT "question_media_variant_shape" CHECK ((media_role::text IN ('hint_image', 'hint_audio') AND variant_number BETWEEN 0 AND 3 AND suggested_points IS NOT NULL AND suggested_points BETWEEN 1 AND 600) OR (media_role::text NOT IN ('hint_image', 'hint_audio') AND variant_number = 0 AND suggested_points IS NULL));--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_composed_format_pair" CHECK ((format::text = 'COMPOSED') = (composed_format_id IS NOT NULL));--> statement-breakpoint
ALTER TABLE "game_question_media" ADD CONSTRAINT "game_question_media_variant_role" CHECK ((media_role::text IN ('hint_image', 'hint_audio') AND variant_number BETWEEN 0 AND 3) OR (media_role::text NOT IN ('hint_image', 'hint_audio') AND variant_number = 0));