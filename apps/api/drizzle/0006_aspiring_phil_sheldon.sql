-- Hand-fixed after generation to match docs/modules/tutor.md's DDL:
-- REFERENCES ... ON DELETE CASCADE on user_id, course_id and
-- conversation_id (drizzle-kit cannot follow the cross-module imports, see
-- tutor/infra/schema.ts). Deleting an account deletes its conversations,
-- messages and disclosure flag; deleting a course, its conversations;
-- deleting a conversation, its messages but never the disclosure flag.
-- Pinned by sqlite-conversation-repository.int.test.ts.
CREATE TABLE `conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
	`course_id` text NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
	`title` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_conversations_scope` ON `conversations` (`user_id`,`course_id`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`citations_json` text,
	`issue` text,
	`out_of_band` integer DEFAULT false NOT NULL,
	`partial` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT "messages_role_check" CHECK("messages"."role" IN ('user','assistant')),
	CONSTRAINT "messages_issue_check" CHECK("messages"."issue" IN ('off_topic','sensitive','distress','unavailable','daily_limit'))
);
--> statement-breakpoint
CREATE INDEX `idx_messages_conversation` ON `messages` (`conversation_id`);--> statement-breakpoint
CREATE TABLE `tutor_disclosures` (
	`user_id` text PRIMARY KEY NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
	`shown_at` text NOT NULL
);
