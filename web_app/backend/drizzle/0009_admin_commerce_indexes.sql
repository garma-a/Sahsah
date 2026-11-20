CREATE INDEX "promotions_staff_list" ON "promotions" USING btree ("starts_at","id");--> statement-breakpoint
CREATE INDEX "token_orders_staff_list" ON "token_orders" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "token_orders_promotion_list" ON "token_orders" USING btree ("applied_promotion_id","created_at","id") WHERE applied_promotion_id IS NOT NULL;