CREATE INDEX "accounts_positive_bank" ON "accounts" USING btree ("token_balance") WHERE token_balance > 0;--> statement-breakpoint
CREATE INDEX "question_packs_open_drafts" ON "question_packs" USING btree ("created_at","id") WHERE publication_state = 'draft' AND archived_at IS NULL;--> statement-breakpoint
CREATE INDEX "game_questions_feedback_by_question" ON "game_questions" USING btree ("source_question_id","feedback_vote") WHERE feedback_vote IS NOT NULL;--> statement-breakpoint
CREATE INDEX "games_started_at" ON "games" USING btree ("started_at");