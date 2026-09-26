-- Hand-fixed after generation to match docs/modules/exercise-generator.md's
-- DDL: REFERENCES ... ON DELETE CASCADE on items.course_id,
-- course_generations.course_id and every user_id (drizzle-kit cannot follow
-- the cross-module imports, see exercise-generator/infra/schema.ts).
-- Decided at M3's opening: deleting an account deletes its items,
-- exercises and split outcomes. Pinned by sqlite-item-repository.int.test.ts.
CREATE TABLE `course_generations` (
	`course_id` text PRIMARY KEY NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
	`user_id` text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
	`split_outcome` text NOT NULL,
	`item_count` integer NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "course_generations_split_outcome_check" CHECK("course_generations"."split_outcome" IN ('items_ready','insufficient_coverage'))
);
--> statement-breakpoint
CREATE TABLE `exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`user_id` text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
	`type` text NOT NULL,
	`content_json` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "exercises_type_check" CHECK("exercises"."type" IN ('delayed_copy','mcq','matching','reordering','cloze','true_false','mental_math'))
);
--> statement-breakpoint
CREATE INDEX `idx_exercises_item` ON `exercises` (`item_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `exercises_item_type_unique` ON `exercises` (`item_id`,`type`);--> statement-breakpoint
CREATE TABLE `items` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
	`user_id` text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`game_types_json` text NOT NULL,
	`position` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_items_course` ON `items` (`course_id`,`position`);--> statement-breakpoint
CREATE UNIQUE INDEX `items_course_position_unique` ON `items` (`course_id`,`position`);