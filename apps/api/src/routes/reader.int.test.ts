import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Argon2PasswordHasher, createAccount, SqliteAccountRepository, uuidV7Generator } from "@studiakids/core";
import { sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { openDatabase, type Db } from "../db/connection.js";
import { runMigrations } from "../db/migrate.js";

const PASSWORD = "correct-horse";
const LONG_AGO = "2026-01-01T00:00:00.000Z";

// docs/modules/reader.md, API and Tests clés.
describe("GET /api/courses/:id/text", () => {
  let volume: string;
  let db: Db;
  let app: ReturnType<typeof buildApp>;
  let lea: string;
  let tom: string;

  async function login(username: string): Promise<string> {
    const res = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username, password: PASSWORD } });
    const raw = res.headers["set-cookie"];
    const match = /^([^=]+)=([^;]+)/.exec(Array.isArray(raw) ? (raw[0] ?? "") : (raw ?? ""));
    if (!match) throw new Error("no session cookie");
    return `${match[1]}=${match[2]}`;
  }

  function seedCourse(username: string, state: { confirmed: boolean; status: string }): string {
    const userId = db.get<{ id: string }>(sql`SELECT id FROM accounts WHERE username = ${username}`).id;
    const id = uuidV7Generator.next();
    db.run(sql`INSERT INTO courses (id, user_id, title, grade, color, extraction_status, confirmed, created_at, last_accessed_at)
               VALUES (${id}, ${userId}, 'Le verbe', 'CE2', 'matiere-francais', ${state.status}, ${state.confirmed ? 1 : 0}, ${LONG_AGO}, ${LONG_AGO})`);
    for (const index of [0, 1]) {
      db.run(sql`INSERT INTO pages (course_id, page_index, sha256, stored_path, size_bytes)
                 VALUES (${id}, ${index}, ${`sha-${id}-${String(index)}`}, ${`photos/${userId}/${id}/${String(index)}.jpg`}, 100)`);
    }
    if (state.status === "ready") db.run(sql`INSERT INTO extractions (course_id, markdown, extracted_at) VALUES (${id}, '# Le verbe\n\n- **chanter**', ${LONG_AGO})`);
    return id;
  }

  const lastAccess = (id: string) => db.get<{ at: string }>(sql`SELECT last_accessed_at AS at FROM courses WHERE id = ${id}`).at;

  beforeEach(async () => {
    volume = mkdtempSync(path.join(tmpdir(), "studiakids-api-reader-"));
    const dbPath = path.join(volume, "test.db");
    db = openDatabase(dbPath);
    runMigrations(db);
    const accounts = { accountRepository: new SqliteAccountRepository(db), passwordHasher: new Argon2PasswordHasher(), idGenerator: uuidV7Generator };
    await createAccount(accounts, "lea", PASSWORD, "Léa", "CE2", new Date());
    await createAccount(accounts, "tom", PASSWORD, "Tom", "CE2", new Date());
    app = buildApp({ databasePath: dbPath, dataDir: volume, sessionSecret: "test-session-secret", cookieSecure: false });
    lea = await login("lea");
    tom = await login("tom");
  });

  afterEach(async () => {
    await app.close();
    rmSync(volume, { recursive: true, force: true });
  });

  it("gives the Markdown, the text to speak and the photos, and records the access", async () => {
    const id = seedCourse("lea", { confirmed: true, status: "ready" });

    const res = await app.inject({ method: "GET", url: `/api/courses/${id}/text`, headers: { cookie: lea } });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ markdown: "# Le verbe\n\n- **chanter**", speech: "Le verbe\nchanter", photos: [{ index: 0 }, { index: 1 }] });
    expect(lastAccess(id) > LONG_AGO).toBe(true);
  });

  it("refuses a course the child has not confirmed with 409 not_ready, never a 500", async () => {
    const unconfirmed = seedCourse("lea", { confirmed: false, status: "ready" });
    const running = seedCourse("lea", { confirmed: false, status: "running" });

    for (const id of [unconfirmed, running]) {
      const res = await app.inject({ method: "GET", url: `/api/courses/${id}/text`, headers: { cookie: lea } });
      expect(res.statusCode).toBe(409);
      expect(res.json()).toEqual({ error: "not_ready" });
    }
    expect(lastAccess(unconfirmed)).toBe(LONG_AGO);
  });

  it("answers another account's course exactly like an unknown id, and leaves it untouched", async () => {
    const id = seedCourse("lea", { confirmed: true, status: "ready" });

    const other = await app.inject({ method: "GET", url: `/api/courses/${id}/text`, headers: { cookie: tom } });
    const unknown = await app.inject({ method: "GET", url: `/api/courses/${uuidV7Generator.next()}/text`, headers: { cookie: tom } });

    const comparable = (headers: Record<string, unknown>) => {
      const { date: _date, "set-cookie": _cookie, ...rest } = headers;
      return rest;
    };
    expect(other.statusCode).toBe(404);
    expect(other.body).toBe(unknown.body);
    expect(comparable(other.headers)).toEqual(comparable(unknown.headers));
    expect(lastAccess(id)).toBe(LONG_AGO);
  });
});
