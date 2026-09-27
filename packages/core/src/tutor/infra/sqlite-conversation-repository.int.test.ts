import { sql } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { freshDb, type Db } from "../../../../../tests/support/db.js";
import type { Conversation, Message } from "../domain/types.js";
import { SqliteConversationRepository } from "./sqlite-conversation-repository.js";

const at = "2026-09-27T08:00:00.000Z";
const now = new Date("2026-09-27T10:00:00.000Z");

function seed(db: Db, userId: string, courseId: string): void {
  db.run(sql`INSERT OR IGNORE INTO accounts (id, username, password_hash, session_version, first_name, grade, created_at) VALUES (${userId}, ${`user-${userId}`}, 'x', 1, 'Léa', 'CM1', ${at})`);
  db.run(sql`INSERT INTO courses (id, user_id, title, grade, color, extraction_status, confirmed, created_at, last_accessed_at)
             VALUES (${courseId}, ${userId}, 'Le verbe', 'CM1', 'matiere-francais', 'ready', 1, ${at}, ${at})`);
}

const conversation = (id: string, userId: string, courseId: string, createdAt = at): Conversation => ({ id, userId, courseId, title: null, createdAt });
const message = (id: string, conversationId: string, role: Message["role"], extra: Partial<Message> = {}): Message => ({
  id,
  conversationId,
  role,
  content: `texte ${id}`,
  citations: null,
  issue: null,
  outOfBand: false,
  partial: false,
  createdAt: now.toISOString(),
  ...extra,
});

describe("SqliteConversationRepository", () => {
  let cleanup: (() => void) | undefined;
  afterEach(() => cleanup?.());

  function setup() {
    const fresh = freshDb();
    cleanup = fresh.cleanup;
    seed(fresh.db, "u1", "c1");
    seed(fresh.db, "u1", "c2");
    seed(fresh.db, "u2", "c3");
    return { db: fresh.db, repo: new SqliteConversationRepository(fresh.db) };
  }
  const count = (db: Db, table: string) => db.get<{ n: number }>(sql.raw(`SELECT count(*) AS n FROM ${table}`)).n;

  it("stores an exchange and reads it back whole, in order, only for its account", async () => {
    const { repo } = setup();
    await repo.create("u1", conversation("k1", "u1", "c1"));
    const answer = message("m2", "k1", "assistant", { citations: [{ text: "Le verbe indique…" }] });
    await repo.appendExchange("u1", "k1", [message("m1", "k1", "user"), answer], "c koi un verbe");

    expect(await repo.listMessages("u1", "k1")).toEqual([message("m1", "k1", "user"), answer]);
    expect(await repo.find("u1", "k1")).toEqual({ ...conversation("k1", "u1", "c1"), title: "c koi un verbe" });
    expect(await repo.find("u2", "k1")).toBeNull();
    expect(await repo.listMessages("u2", "k1")).toEqual([]);
  });

  it("keeps each flag of a fixed message: distress out of band, partial, issue", async () => {
    const { repo } = setup();
    await repo.create("u1", conversation("k1", "u1", "c1"));
    const distress = message("m2", "k1", "assistant", { issue: "distress", outOfBand: true });
    const partial = message("m4", "k1", "assistant", { partial: true });
    await repo.appendExchange("u1", "k1", [message("m1", "k1", "user"), distress], "t");
    await repo.appendExchange("u1", "k1", [message("m3", "k1", "user"), partial], "t");

    expect((await repo.listMessages("u1", "k1")).filter((m) => m.role === "assistant")).toEqual([distress, partial]);
  });

  it("sets the title once, and never writes into another account's conversation", async () => {
    const { db, repo } = setup();
    await repo.create("u1", conversation("k1", "u1", "c1"));
    await repo.appendExchange("u1", "k1", [message("m1", "k1", "user")], "première");
    await repo.appendExchange("u1", "k1", [message("m2", "k1", "user")], "seconde");

    await expect(repo.appendExchange("u2", "k1", [message("m3", "k1", "user")], "x")).rejects.toThrow();
    expect((await repo.find("u1", "k1"))?.title).toBe("première");
    expect(count(db, "messages")).toBe(2);
  });

  it("refuses an issue outside the five fixed ones", async () => {
    const { repo } = setup();
    await repo.create("u1", conversation("k1", "u1", "c1"));
    const bad = { ...message("m1", "k1", "assistant"), issue: "other" } as unknown as Message;
    await expect(repo.appendExchange("u1", "k1", [bad], "t")).rejects.toThrow();
  });

  it("finds the course's latest conversation, and lists the course's only", async () => {
    const { repo } = setup();
    await repo.create("u1", conversation("k1", "u1", "c1", "2026-09-27T08:00:00.000Z"));
    await repo.create("u1", conversation("k2", "u1", "c1", "2026-09-27T09:00:00.000Z"));
    await repo.create("u1", conversation("k3", "u1", "c2", "2026-09-27T09:30:00.000Z"));

    expect((await repo.latestForCourse("u1", "c1"))?.id).toBe("k2");
    expect(await repo.latestForCourse("u2", "c1")).toBeNull();
    expect((await repo.listForCourse("u1", "c1")).map((c) => c.id)).toEqual(["k2", "k1"]);
  });

  it("counts the account's questions since an instant, in every conversation, never another account's", async () => {
    const { repo } = setup();
    await repo.create("u1", conversation("k1", "u1", "c1"));
    await repo.create("u1", conversation("k2", "u1", "c2"));
    await repo.create("u2", conversation("k3", "u2", "c3"));
    await repo.appendExchange("u1", "k1", [message("m1", "k1", "user", { createdAt: "2026-09-26T09:00:00.000Z" }), message("m2", "k1", "assistant")], "t");
    await repo.appendExchange("u1", "k2", [message("m3", "k2", "user"), message("m4", "k2", "assistant")], "t");
    await repo.appendExchange("u2", "k3", [message("m5", "k3", "user")], "t");

    expect(await repo.questionTimesSince("u1", "2026-09-26T00:00:00.000Z")).toEqual(["2026-09-26T09:00:00.000Z", now.toISOString()]);
    expect(await repo.questionTimesSince("u1", "2026-09-27T00:00:00.000Z")).toEqual([now.toISOString()]);
  });

  it("deletes a conversation with its messages, only for its account", async () => {
    const { db, repo } = setup();
    await repo.create("u1", conversation("k1", "u1", "c1"));
    await repo.appendExchange("u1", "k1", [message("m1", "k1", "user")], "t");

    expect(await repo.delete("u2", "k1")).toBe(false);
    expect(await repo.delete("u1", "k1")).toBe(true);
    expect(count(db, "conversations")).toBe(0);
    expect(count(db, "messages")).toBe(0);
  });

  it("the disclosure is new once per account, and outlives the conversations", async () => {
    const { repo } = setup();
    await repo.create("u1", conversation("k1", "u1", "c1"));
    expect(await repo.markDisclosed("u1", now)).toBe(true);
    await repo.delete("u1", "k1");

    expect(await repo.markDisclosed("u1", now)).toBe(false);
    expect(await repo.markDisclosed("u2", now)).toBe(true);
  });

  it("lists everything of an account for its adult, oldest first", async () => {
    const { repo } = setup();
    await repo.create("u1", conversation("k1", "u1", "c1", "2026-09-27T08:00:00.000Z"));
    await repo.create("u1", conversation("k2", "u1", "c2", "2026-09-27T09:00:00.000Z"));
    await repo.create("u2", conversation("k3", "u2", "c3"));
    await repo.appendExchange("u1", "k2", [message("m1", "k2", "user"), message("m2", "k2", "assistant", { issue: "distress", outOfBand: true })], "t");

    const all = await repo.listForAccount("u1");

    expect(all.map((entry) => [entry.conversation.id, entry.messages.map((m) => m.id)])).toEqual([
      ["k1", []],
      ["k2", ["m1", "m2"]],
    ]);
  });

  // Cascades (docs/modules/tutor.md, Persistance).
  it("deleting a course deletes its conversations and their messages, never the disclosure", async () => {
    const { db, repo } = setup();
    await repo.create("u1", conversation("k1", "u1", "c1"));
    await repo.appendExchange("u1", "k1", [message("m1", "k1", "user")], "t");
    await repo.markDisclosed("u1", now);

    db.run(sql`DELETE FROM courses WHERE id = 'c1'`);

    expect(count(db, "conversations")).toBe(0);
    expect(count(db, "messages")).toBe(0);
    expect(count(db, "tutor_disclosures")).toBe(1);
  });

  it("deleting an account deletes its conversations, messages and disclosure, and leaves another's", async () => {
    const { db, repo } = setup();
    await repo.create("u1", conversation("k1", "u1", "c1"));
    await repo.create("u2", conversation("k3", "u2", "c3"));
    await repo.appendExchange("u1", "k1", [message("m1", "k1", "user")], "t");
    await repo.appendExchange("u2", "k3", [message("m2", "k3", "user")], "t");
    await repo.markDisclosed("u1", now);
    await repo.markDisclosed("u2", now);

    db.run(sql`DELETE FROM accounts WHERE id = 'u1'`);

    expect(db.all<{ id: string }>(sql`SELECT id FROM conversations`)).toEqual([{ id: "k3" }]);
    expect(db.all<{ id: string }>(sql`SELECT id FROM messages`)).toEqual([{ id: "m2" }]);
    expect(db.all<{ user_id: string }>(sql`SELECT user_id FROM tutor_disclosures`)).toEqual([{ user_id: "u2" }]);
  });

  // Found by mutation testing (M6): the account's cascade is also the
  // guarantee that no conversation exists for an unknown account.
  it("a conversation needs an existing account and course", async () => {
    const { repo } = setup();
    await expect(repo.create("ghost", conversation("k1", "ghost", "c1"))).rejects.toThrow();
    await expect(repo.create("u1", conversation("k2", "u1", "no-course"))).rejects.toThrow();
  });
});
