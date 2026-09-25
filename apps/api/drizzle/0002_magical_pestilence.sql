-- Hand-fixed after generation to match docs/modules/ingestion.md's DDL:
-- courses.user_id REFERENCES accounts(id) ON DELETE CASCADE (drizzle-kit
-- cannot follow the cross-module import, see ingestion/infra/schema.ts),
-- and last_accessed_at DESC in idx_courses_user_last_accessed (not
-- expressible in this drizzle-orm version). Pinned by
-- sqlite-course-repository.int.test.ts.
CREATE TABLE `courses` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
	`title` text DEFAULT '' NOT NULL,
	`subject` text,
	`grade` text NOT NULL,
	`color` text DEFAULT '' NOT NULL,
	`extraction_status` text NOT NULL,
	`confirmed` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`last_accessed_at` text NOT NULL,
	CONSTRAINT "courses_grade_check" CHECK("courses"."grade" IN ('CP','CE1','CE2','CM1','CM2','6e')),
	CONSTRAINT "courses_subject_check" CHECK("courses"."subject" IN ('maths','french','history','geography','science','english','other')),
	CONSTRAINT "courses_extraction_status_check" CHECK("courses"."extraction_status" IN ('pending','running','illegible','not_a_course_page','ready'))
);
--> statement-breakpoint
CREATE INDEX `idx_courses_user_last_accessed` ON `courses` (`user_id`,`last_accessed_at` DESC);--> statement-breakpoint
CREATE TABLE `extractions` (
	`course_id` text PRIMARY KEY NOT NULL,
	`markdown` text NOT NULL,
	`extracted_at` text NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `pages` (
	`course_id` text NOT NULL,
	`page_index` integer NOT NULL,
	`sha256` text NOT NULL,
	`stored_path` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`legible` integer,
	`is_course_page` integer,
	`unusable_reason` text,
	PRIMARY KEY(`course_id`, `page_index`),
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pages_course_sha256_unique` ON `pages` (`course_id`,`sha256`);