import { and, asc, desc, eq, gte, inArray } from "drizzle-orm";
import type { drizzle } from "drizzle-orm/better-sqlite3";
import { z } from "zod";
import type { ConversationRepository } from "../domain/ports.js";
import type { Conversation, Message } from "../domain/types.js";
import { conversationsTable, messagesTable, tutorDisclosuresTable } from "./schema.js";

export type TutorDb = ReturnType<typeof drizzle>;

const citationsSchema = z.array(z.object({ text: z.string() }));
// The CHECK constraint holds the same five.
const issueSchema = z.enum(["off_topic", "sensitive", "distress", "unavailable", "daily_limit"]).nullable();
type MessageRow = typeof messagesTable.$inferSelect;

const toMessage = (row: MessageRow): Message => ({
  id: row.id,
  conversationId: row.conversationId,
  role: row.role === "assistant" ? "assistant" : "user",
  content: row.content,
  citations: row.citationsJson === null ? null : citationsSchema.parse(JSON.parse(row.citationsJson)),
  issue: issueSchema.parse(row.issue),
  outOfBand: row.outOfBand,
  partial: row.partial,
  createdAt: row.createdAt,
});

// better-sqlite3 is synchronous: a failed write must still reach the caller
// as a rejected promise, never as an exception thrown past it.
function settle(write: () => void): Promise<void> {
  try {
    write();
    return Promise.resolve();
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error(String(error)));
  }
}

export class SqliteConversationRepository implements ConversationRepository {
  constructor(private readonly db: TutorDb) {}

  create(userId: string, conversation: Conversation): Promise<void> {
    return settle(() => {
      this.db.insert(conversationsTable).values({ ...conversation, userId }).run();
    });
  }

  find(userId: string, conversationId: string): Promise<Conversation | null> {
    return Promise.resolve(this.db.select().from(conversationsTable).where(and(eq(conversationsTable.userId, userId), eq(conversationsTable.id, conversationId))).get() ?? null);
  }

  latestForCourse(userId: string, courseId: string): Promise<Conversation | null> {
    return this.listForCourse(userId, courseId).then((list) => list[0] ?? null);
  }

  listForCourse(userId: string, courseId: string): Promise<Conversation[]> {
    return Promise.resolve(
      this.db
        .select()
        .from(conversationsTable)
        .where(and(eq(conversationsTable.userId, userId), eq(conversationsTable.courseId, courseId)))
        .orderBy(desc(conversationsTable.createdAt), desc(conversationsTable.id))
        .all(),
    );
  }

  async listMessages(userId: string, conversationId: string): Promise<Message[]> {
    if (!(await this.find(userId, conversationId))) return [];
    return this.db.select().from(messagesTable).where(eq(messagesTable.conversationId, conversationId)).orderBy(asc(messagesTable.createdAt), asc(messagesTable.id)).all().map(toMessage);
  }

  // One short transaction, after every model call (CLAUDE.md, rule 2).
  appendExchange(userId: string, conversationId: string, messages: Message[], title: string): Promise<void> {
    return settle(() => {
      this.db.transaction((tx) => {
        const owned = tx.select({ title: conversationsTable.title }).from(conversationsTable).where(and(eq(conversationsTable.userId, userId), eq(conversationsTable.id, conversationId))).get();
        if (!owned) throw new Error("conversation not owned");
        if (owned.title === null) tx.update(conversationsTable).set({ title }).where(eq(conversationsTable.id, conversationId)).run();
        for (const message of messages) {
          tx.insert(messagesTable)
            .values({ ...message, conversationId, citationsJson: message.citations === null ? null : JSON.stringify(message.citations) })
            .run();
        }
      });
    });
  }

  questionTimesSince(userId: string, since: string): Promise<string[]> {
    const rows = this.db
      .select({ createdAt: messagesTable.createdAt })
      .from(messagesTable)
      .innerJoin(conversationsTable, eq(messagesTable.conversationId, conversationsTable.id))
      .where(and(eq(conversationsTable.userId, userId), eq(messagesTable.role, "user"), gte(messagesTable.createdAt, since)))
      .orderBy(asc(messagesTable.createdAt))
      .all();
    return Promise.resolve(rows.map((row) => row.createdAt));
  }

  delete(userId: string, conversationId: string): Promise<boolean> {
    const result = this.db.delete(conversationsTable).where(and(eq(conversationsTable.userId, userId), eq(conversationsTable.id, conversationId))).run();
    return Promise.resolve(result.changes > 0);
  }

  markDisclosed(userId: string, now: Date): Promise<boolean> {
    const result = this.db.insert(tutorDisclosuresTable).values({ userId, shownAt: now.toISOString() }).onConflictDoNothing().run();
    return Promise.resolve(result.changes > 0);
  }

  listForAccount(userId: string): Promise<{ conversation: Conversation; messages: Message[] }[]> {
    const conversations = this.db.select().from(conversationsTable).where(eq(conversationsTable.userId, userId)).orderBy(asc(conversationsTable.createdAt), asc(conversationsTable.id)).all();
    const ids = conversations.map((conversation) => conversation.id);
    const messages = ids.length === 0 ? [] : this.db.select().from(messagesTable).where(inArray(messagesTable.conversationId, ids)).orderBy(asc(messagesTable.createdAt), asc(messagesTable.id)).all().map(toMessage);
    return Promise.resolve(conversations.map((conversation) => ({ conversation, messages: messages.filter((message) => message.conversationId === conversation.id) })));
  }
}
