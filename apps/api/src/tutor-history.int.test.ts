import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Argon2PasswordHasher, createAccount, DISTRESS_TEXT, fixedText, SqliteAccountRepository, SqliteConversationRepository, uuidV7Generator, type Message } from "@studiakids/core";
import { sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase, type Db } from "./db/connection.js";
import { runMigrations } from "./db/migrate.js";
import { tutorHistory } from "./tutor-history.js";

const exportedAt = new Date("2026-09-27T10:00:00.000Z");

// docs/securite.md (M6): pnpm tutor:history <username> writes the whole
// history of the account, every course, distress included and flagged.
describe("tutorHistory", () => {
  let volume: string;
  let db: Db;

  beforeEach(async () => {
    volume = mkdtempSync(path.join(tmpdir(), "studiakids-tutor-history-"));
    db = openDatabase(path.join(volume, "test.db"));
    runMigrations(db);
    const accounts = { accountRepository: new SqliteAccountRepository(db), passwordHasher: new Argon2PasswordHasher(), idGenerator: uuidV7Generator };
    await createAccount(accounts, "lea", "correct-horse", "Léa", "CE2", exportedAt);
    await createAccount(accounts, "tom", "correct-horse", "Tom", "CE2", exportedAt);
  });
  afterEach(() => rmSync(volume, { recursive: true, force: true }));

  async function seed(username: string, courseTitle: string, conversationId: string, exchanges: [string, Partial<Message>][], at: string) {
    const userId = db.get<{ id: string }>(sql`SELECT id FROM accounts WHERE username = ${username}`).id;
    const courseId = `c-${conversationId}`;
    db.run(sql`INSERT INTO courses (id, user_id, title, grade, color, extraction_status, confirmed, created_at, last_accessed_at) VALUES (${courseId}, ${userId}, ${courseTitle}, 'CE2', 'matiere-francais', 'ready', 1, ${at}, ${at})`);
    const repo = new SqliteConversationRepository(db);
    await repo.create(userId, { id: conversationId, userId, courseId, title: null, createdAt: at });
    let n = 0;
    for (const [question, answer] of exchanges) {
      const base = { conversationId, citations: null, issue: null, outOfBand: false, partial: false, createdAt: at };
      await repo.appendExchange(userId, conversationId, [
        { ...base, id: `${conversationId}-${String(n++)}`, role: "user", content: question },
        { ...base, id: `${conversationId}-${String(n++)}`, role: "assistant", content: "", ...answer },
      ], question);
    }
  }

  it("writes every course's conversations, who speaks, when (Paris time), and flags each fixed issue", async () => {
    await seed("lea", "Le verbe", "k1", [
      ["c koi un verbe ?", { content: "Un verbe, c'est une action.", citations: [{ text: "Le verbe indique…" }] }],
      ["c'est quoi le meilleur jeu vidéo", { content: fixedText("off_topic"), issue: "off_topic" }],
      ["mon grand frère me tape", { content: DISTRESS_TEXT, issue: "distress", outOfBand: true }],
    ], "2026-09-26T16:05:00.000Z");
    await seed("lea", "Les fractions", "k2", [["c koi un demi", { content: "La moitié", partial: true }]], "2026-09-27T07:00:00.000Z");
    await seed("tom", "Secret de Tom", "k3", [["question de tom", { content: "r" }]], "2026-09-27T07:00:00.000Z");

    const result = await tutorHistory(db, "lea", { json: false }, exportedAt);
    if (!result.ok) throw new Error(result.error);
    const text = result.value;

    expect(text).toContain("lea");
    expect(text).toContain("« Le verbe »");
    expect(text).toContain("« Les fractions »");
    expect(text).toContain("26/09/2026 18:05");
    expect(text).toMatch(/Enfant : c koi un verbe \?/);
    expect(text).toMatch(/Tuteur : Un verbe, c'est une action\./);
    expect(text).toMatch(/refus, hors sujet/);
    expect(text).toMatch(/DÉTRESSE/);
    expect(text).toContain("mon grand frère me tape");
    expect(text).toContain("le 119, à toute heure");
    expect(text).toMatch(/réponse interrompue/);
    expect(text).not.toContain("Tom");
    expect(text).not.toContain("question de tom");
    expect(text.indexOf("Le verbe")).toBeLessThan(text.indexOf("Les fractions"));
  });

  it("--json gives the raw export, distress included", async () => {
    await seed("lea", "Le verbe", "k1", [["mon grand frère me tape", { content: DISTRESS_TEXT, issue: "distress", outOfBand: true }]], "2026-09-26T16:05:00.000Z");

    const result = await tutorHistory(db, "lea", { json: true }, exportedAt);
    if (!result.ok) throw new Error(result.error);

    expect(JSON.parse(result.value)).toEqual({
      username: "lea",
      exportedAt: exportedAt.toISOString(),
      conversations: [
        {
          courseTitle: "Le verbe",
          conversation: expect.objectContaining({ id: "k1", title: "mon grand frère me tape" }) as unknown,
          messages: [expect.objectContaining({ role: "user", content: "mon grand frère me tape" }) as unknown, expect.objectContaining({ role: "assistant", issue: "distress", outOfBand: true, content: DISTRESS_TEXT }) as unknown],
        },
      ],
    });
  });

  it("an account without a conversation says so; an unknown account is an error", async () => {
    const empty = await tutorHistory(db, "tom", { json: false }, exportedAt);
    expect(empty.ok && empty.value).toMatch(/Aucune conversation/);
    expect(await tutorHistory(db, "nobody", { json: false }, exportedAt)).toEqual({ ok: false, error: "not-found" });
  });
});
