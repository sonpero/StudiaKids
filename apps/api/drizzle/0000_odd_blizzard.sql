CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`session_version` integer DEFAULT 1 NOT NULL,
	`first_name` text NOT NULL,
	`grade` text NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT "grade_check" CHECK("accounts"."grade" IN ('CP','CE1','CE2','CM1','CM2','6e'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_username_unique` ON `accounts` (`username`);