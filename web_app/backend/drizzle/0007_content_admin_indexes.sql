CREATE INDEX "categories_display_order" ON "categories" USING btree ("display_order","id");--> statement-breakpoint
CREATE INDEX "categories_section_display_order" ON "categories" USING btree ("section_id","display_order","id");--> statement-breakpoint
CREATE INDEX "questions_pack_history" ON "questions" USING btree ("pack_id","slot_number","id");