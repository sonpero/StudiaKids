-- Deleting a confirmed course (decided on 2026-10-04): attempts outlive
-- their exercise, so that no star is ever lost. exercise_id loses its
-- REFERENCES exercises(id) ON DELETE CASCADE and stays as an opaque key
-- (one star per exercise per day); type and unit_id become nullable, set to
-- null when a course's attempts are detached. user_id keeps its
-- REFERENCES accounts(id) ON DELETE CASCADE, added by hand (drizzle-kit
-- cannot follow the cross-module import, see game-engine/infra/schema.ts).
-- Every existing row is copied as it is. Pinned by
-- sqlite-attempt-repository.int.test.ts and attempt-detachment.int.test.ts.
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
	`exercise_id` text NOT NULL,
	`type` text,
	`unit_id` text,
	`correct` integer NOT NULL,
	`star_eligible` integer DEFAULT true NOT NULL,
	`attempted_at` text NOT NULL,
	CONSTRAINT "attempts_type_check" CHECK("__new_attempts"."type" IN ('delayed_copy','mcq','matching','reordering','cloze','true_false','mental_math'))
);
--> statement-breakpoint
INSERT INTO `__new_attempts`("id", "user_id", "exercise_id", "type", "unit_id", "correct", "star_eligible", "attempted_at") SELECT "id", "user_id", "exercise_id", "type", "unit_id", "correct", "star_eligible", "attempted_at" FROM `attempts`;--> statement-breakpoint
DROP TABLE `attempts`;--> statement-breakpoint
ALTER TABLE `__new_attempts` RENAME TO `attempts`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_attempts_user` ON `attempts` (`user_id`,`attempted_at`);--> statement-breakpoint
CREATE INDEX `idx_attempts_exercise` ON `attempts` (`exercise_id`);