-- Hand-fixed after generation to match docs/modules/jobs.md's DDL:
-- REFERENCES accounts(id) ON DELETE CASCADE on user_id (jobs/ may not import
-- auth's schema, see packages/core/src/jobs/infra/schema.ts), the status
-- CHECK, and created_at DESC in idx_jobs_user (not expressible in this
-- drizzle-orm version). Pinned by sqlite-job-queue.int.test.ts.
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
	`type` text NOT NULL,
	`payload_json` text NOT NULL,
	`status` text NOT NULL CHECK (status IN ('pending','running','done','failed')),
	`attempts` integer DEFAULT 0 NOT NULL,
	`max_attempts` integer DEFAULT 3 NOT NULL,
	`last_error` text,
	`run_after` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_jobs_claim` ON `jobs` (`status`,`run_after`);--> statement-breakpoint
CREATE INDEX `idx_jobs_user` ON `jobs` (`user_id`,`type`,`created_at` DESC);