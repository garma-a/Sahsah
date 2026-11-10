CREATE TABLE "category_sections" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name_ar" text NOT NULL,
	"name_franco" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "category_sections_display_order_bounds" CHECK (display_order >= 0),
	CONSTRAINT "category_sections_name_bounds" CHECK (length(btrim(name_ar)) > 0 AND char_length(name_ar) <= 160 AND (name_franco IS NULL OR (length(btrim(name_franco)) > 0 AND char_length(name_franco) <= 160)))
);
--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "section_id" uuid;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "description_ar" text;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "description_franco" text;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "cover_media_asset_id" uuid;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_section" FOREIGN KEY ("section_id") REFERENCES "public"."category_sections"("id") ON DELETE no action ON UPDATE no action DEFERRABLE INITIALLY IMMEDIATE;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_cover_asset" FOREIGN KEY ("cover_media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE no action ON UPDATE no action DEFERRABLE INITIALLY IMMEDIATE;--> statement-breakpoint
CREATE INDEX "categories_section" ON "categories" USING btree ("section_id","id");--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_description_bounds" CHECK ((description_ar IS NULL OR (length(btrim(description_ar)) > 0 AND char_length(description_ar) <= 500)) AND (description_franco IS NULL OR (length(btrim(description_franco)) > 0 AND char_length(description_franco) <= 500)));