-- Hand-fixed after generation to match docs/modules/game-engine.md's DDL:
-- REFERENCES ... ON DELETE CASCADE on user_id and exercise_id (drizzle-kit
-- cannot follow the cross-module imports, see game-engine/infra/schema.ts).
-- Decided at M4's opening: deleting an account deletes its attempts. No
-- column for the given answer (minimisation). Pinned by
-- sqlite-attempt-repository.int.test.ts.
CREATE TABLE `attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
	`exercise_id` text NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
	`type` text NOT NULL,
	`unit_id` text NOT NULL,
	`correct` integer NOT NULL,
	`star_eligible` integer DEFAULT true NOT NULL,
	`attempted_at` text NOT NULL,
	CONSTRAINT "attempts_type_check" CHECK("attempts"."type" IN ('delayed_copy','mcq','matching','reordering','cloze','true_false','mental_math'))
);
--> statement-breakpoint
CREATE INDEX `idx_attempts_user` ON `attempts` (`user_id`,`attempted_at`);--> statement-breakpoint
CREATE INDEX `idx_attempts_exercise` ON `attempts` (`exercise_id`);