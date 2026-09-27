import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// user_id, course_id and conversation_id have no drizzle `.references()`:
// drizzle-kit loads schema files with a plain require() that cannot follow
// NodeNext `.js` imports across modules (CLAUDE.md, Spécificités SQLite).
// Their `REFERENCES ... ON DELETE CASCADE` are added by hand in the
// generated migration (0006), and pinned by
// sqlite-conversation-repository.int.test.ts.
export const conversationsTable = sqliteTable(
  "conversations",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    courseId: text("course_id").notNull(),
    title: text("title"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_conversations_scope").on(table.userId, table.courseId)],
);

export const messagesTable = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id").notNull(),
    role: text("role").notNull(),
    content: text("content").notNull(),
    citationsJson: text("citations_json"),
    issue: text("issue"),
    // 1 only for issue='distress' (docs/donnees.md).
    outOfBand: integer("out_of_band", { mode: "boolean" }).notNull().default(false),
    partial: integer("partial", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    check("messages_role_check", sql`${table.role} IN ('user','assistant')`),
    check("messages_issue_check", sql`${table.issue} IN ('off_topic','sensitive','distress','unavailable','daily_limit')`),
    index("idx_messages_conversation").on(table.conversationId),
  ],
);

// Separate from conversations on purpose: it must outlive them
// (docs/modules/tutor.md, "Information de l'enfant").
export const tutorDisclosuresTable = sqliteTable("tutor_disclosures", {
  userId: text("user_id").primaryKey(),
  shownAt: text("shown_at").notNull(),
});
