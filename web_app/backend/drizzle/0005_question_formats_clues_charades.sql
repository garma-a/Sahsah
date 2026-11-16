ALTER TYPE "public"."question_format" ADD VALUE 'IMAGE_CLUES';--> statement-breakpoint
ALTER TYPE "public"."question_format" ADD VALUE 'CHARADES';--> statement-breakpoint
ALTER TABLE "question_media" DROP CONSTRAINT "question_media_variant_shape";--> statement-breakpoint
ALTER TABLE "game_question_media" DROP CONSTRAINT "game_question_media_variant_role";--> statement-breakpoint
ALTER TABLE "question_media" ADD CONSTRAINT "question_media_variant_shape" CHECK ((media_role = 'hint_image' AND variant_number BETWEEN 0 AND 3 AND suggested_points IS NOT NULL AND suggested_points BETWEEN 1 AND 600) OR (media_role <> 'hint_image' AND variant_number = 0 AND suggested_points IS NULL));--> statement-breakpoint
ALTER TABLE "game_question_media" ADD CONSTRAINT "game_question_media_variant_role" CHECK ((media_role = 'hint_image' AND variant_number BETWEEN 0 AND 3) OR (media_role <> 'hint_image' AND variant_number = 0));