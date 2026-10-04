import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Argon2PasswordHasher, createAccount, handleGenerationJob, IngestionCourseTexts, ok, SqliteAccountRepository, SqliteCourseRepository, SqliteItemRepository, uuidV7Generator } from "@studiakids/core";
import { sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { openDatabase, type Db } from "./db/connection.js";
import { runMigrations } from "./db/migrate.js";

// Deleting a confirmed course (decided on 2026-10-04): DELETE
// /api/courses/:id takes everything of the course — text, items,
// exercises, tutor conversations, jobs — but never a star nor the streak.
const PASSWORD = "correct-horse";
const DAY = (n: number) => `2026-10-0${String(n)}T08:00:00.000Z`;

describe("deleting a confirmed course", () => {
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

  const idOf = (username: string) => db.get<{ id: string }>(sql`SELECT id FROM accounts WHERE username = ${username}`).id;

  // A confirmed course, played on three days, with a tutor conversation, a
  // retired exercise and jobs; every row named after the course.
  function playedCourse(username: string, courseId: string): void {
    const userId = idOf(username);
    db.run(sql`INSERT INTO courses (id, user_id, title, subject, grade, color, extraction_status, confirmed, created_at, last_accessed_at)
               VALUES (${courseId}, ${userId}, 'Le verbe', 'french', 'CE2', 'matiere-francais', 'ready', 1, ${DAY(1)}, ${DAY(1)})`);
    db.run(sql`INSERT INTO extractions (course_id, markdown, extracted_at) VALUES (${courseId}, '# Le verbe secret', ${DAY(1)})`);
    db.run(sql`INSERT INTO course_generations (course_id, user_id, split_outcome, item_count, updated_at) VALUES (${courseId}, ${userId}, 'items_ready', 6, ${DAY(1)})`);
    db.run(sql`INSERT INTO items (id, course_id, user_id, title, body, game_types_json, position, created_at) VALUES (${`${courseId}-i0`}, ${courseId}, ${userId}, 'Le verbe', 'Le verbe secret', '["mcq","matching"]', 0, ${DAY(1)})`);
    db.run(sql`INSERT INTO exercises (id, item_id, user_id, type, content_json, created_at) VALUES (${`${courseId}-mcq`}, ${`${courseId}-i0`}, ${userId}, 'mcq', '{"question":"secret"}', ${DAY(1)})`);
    db.run(sql`INSERT INTO exercises (id, item_id, user_id, type, content_json, created_at, retired) VALUES (${`${courseId}-match`}, ${`${courseId}-i0`}, ${userId}, 'matching', '{"pairs":"secret"}', ${DAY(1)}, 1)`);
    const attempt = (id: string, exercise: string, type: string, unit: string, correct: boolean, at: string) =>
      db.run(sql`INSERT INTO attempts (id, user_id, exercise_id, type, unit_id, correct, star_eligible, attempted_at) VALUES (${`${courseId}-${id}`}, ${userId}, ${`${courseId}-${exercise}`}, ${type}, ${unit}, ${correct ? 1 : 0}, 1, ${at})`);
    attempt("a1", "mcq", "mcq", "0", false, DAY(1));
    attempt("a2", "mcq", "mcq", "0", true, DAY(2));
    attempt("a3", "match", "matching", "0", true, DAY(3));
    attempt("a4", "match", "matching", "1", true, DAY(3));
    db.run(sql`INSERT INTO conversations (id, user_id, course_id, title, created_at) VALUES (${`${courseId}-conv`}, ${userId}, ${courseId}, 'Le verbe', ${DAY(2)})`);
    db.run(sql`INSERT INTO messages (id, conversation_id, role, content, created_at) VALUES (${`${courseId}-m1`}, ${`${courseId}-conv`}, 'user', 'c koi un verbe secret ?', ${DAY(2)})`);
    for (const [id, status] of [["j1", "done"], ["j2", "pending"], ["j3", "running"]]) {
      db.run(sql`INSERT INTO jobs (id, user_id, type, payload_json, status, attempts, max_attempts, run_after, created_at, updated_at)
                 VALUES (${`${courseId}-${id}`}, ${userId}, 'generate-exercises', ${JSON.stringify({ courseId, type: "mcq" })}, ${status}, 0, 3, ${DAY(3)}, ${DAY(3)}, ${DAY(3)})`);
    }
  }

  const progress = async (cookie: string) => (await app.inject({ method: "GET", url: "/api/progress", headers: { cookie } })).json<{ total: number; currentStreak: number; bestStreak: number }>();
  const remove = (cookie: string, courseId: string) => app.inject({ method: "DELETE", url: `/api/courses/${courseId}`, headers: { cookie } });
  const count = (table: string, where: string) => db.get<{ n: number }>(sql.raw(`SELECT count(*) AS n FROM ${table} WHERE ${where}`)).n;

  beforeEach(async () => {
    volume = mkdtempSync(path.join(tmpdir(), "studiakids-course-deletion-"));
    const dbPath = path.join(volume, "test.db");
    db = openDatabase(dbPath);
    runMigrations(db);
    const accounts = { accountRepository: new SqliteAccountRepository(db), passwordHasher: new Argon2PasswordHasher(), idGenerator: uuidV7Generator };
    await createAccount(accounts, "lea", PASSWORD, "Léa", "CE2", new Date());
    await createAccount(accounts, "tom", PASSWORD, "Tom", "CE2", new Date());
    app = buildApp({ databasePath: dbPath, dataDir: volume, sessionSecret: "test-session-secret", cookieSecure: false });
    lea = await login("lea");
    tom = await login("tom");
    playedCourse("lea", "verbe");
    playedCourse("lea", "kept");
    playedCourse("tom", "theirs");
  });

  afterEach(async () => {
    await app.close();
    rmSync(volume, { recursive: true, force: true });
  });

  it("the star total and the streak are the same before and after", async () => {
    const before = await progress(lea);
    expect(before.total).toBeGreaterThan(0);

    expect((await remove(lea, "verbe")).statusCode).toBe(204);

    expect(await progress(lea)).toEqual(before);
  });

  it("no row of the course is left — text, items, exercises, conversations, messages, jobs — and the attempts kept carry nothing of it", async () => {
    expect((await remove(lea, "verbe")).statusCode).toBe(204);

    for (const [table, where] of [
      ["courses", "id = 'verbe'"],
      ["extractions", "course_id = 'verbe'"],
      ["course_generations", "course_id = 'verbe'"],
      ["items", "course_id = 'verbe'"],
      ["exercises", "id LIKE 'verbe-%'"],
      ["conversations", "course_id = 'verbe'"],
      ["messages", "id LIKE 'verbe-%'"],
      ["jobs", "json_extract(payload_json, '$.courseId') = 'verbe'"],
    ]) {
      expect(count(table!, where!), table).toBe(0);
    }
    expect(db.all(sql`SELECT exercise_id, type, unit_id FROM attempts WHERE id LIKE 'verbe-%' ORDER BY id`)).toEqual([
      { exercise_id: "verbe-mcq", type: null, unit_id: null },
      { exercise_id: "verbe-mcq", type: null, unit_id: null },
      { exercise_id: "verbe-match", type: null, unit_id: null },
      { exercise_id: "verbe-match", type: null, unit_id: null },
    ]);
    expect(JSON.stringify(db.all(sql`SELECT * FROM attempts WHERE id LIKE 'verbe-%'`))).not.toMatch(/secret|verbe\b(?!-)/);
    // Her other course is untouched.
    expect(count("exercises", "id LIKE 'kept-%'")).toBe(2);
    expect(db.all(sql`SELECT type FROM attempts WHERE id = 'kept-a1'`)).toEqual([{ type: "mcq" }]);
    expect(count("jobs", "json_extract(payload_json, '$.courseId') = 'kept'")).toBe(3);
  });

  it("removes the course's photo directory if one was left", async () => {
    const dir = path.join(volume, "photos", idOf("lea"), "verbe");
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "0.jpg"), "jpeg");

    await remove(lea, "verbe");

    expect(count("courses", "id = 'verbe'")).toBe(0);
    expect(() => writeFileSync(path.join(dir, "1.jpg"), "x")).toThrow();
  });

  it("a generation job still running on the deleted course ends cleanly, writing nothing", async () => {
    await remove(lea, "verbe");
    const repo = new SqliteCourseRepository(db);
    const deps = { courses: new IngestionCourseTexts(repo), repo: new SqliteItemRepository(db), idGenerator: uuidV7Generator, generator: { generate: () => Promise.resolve(ok([])) } };

    expect(await handleGenerationJob(deps, { courseId: "verbe", type: "mcq" }, { jobId: "verbe-j3", userId: idOf("lea"), attempt: 1, now: new Date() })).toEqual(ok(undefined));
    expect(count("items", "course_id = 'verbe'")).toBe(0);
  });

  // Security (docs/securite.md): another account's confirmed course is
  // never deleted, and reads exactly like an unknown id (the existing
  // route test only covered an unconfirmed one).
  it("another account's confirmed course: the same 404 as an unknown id, and nothing deleted", async () => {
    const theirs = await remove(lea, "theirs");
    const unknown = await remove(lea, "no-such-course");

    expect(theirs.statusCode).toBe(404);
    expect(theirs.body).toBe(unknown.body);
    const comparable = ({ date: _date, "set-cookie": _cookie, ...rest }: Record<string, unknown>) => rest;
    expect(comparable(theirs.headers)).toEqual(comparable(unknown.headers));
    expect(count("courses", "id = 'theirs'")).toBe(1);
    expect(count("exercises", "id LIKE 'theirs-%'")).toBe(2);
    expect(db.all(sql`SELECT type FROM attempts WHERE id = 'theirs-a1'`)).toEqual([{ type: "mcq" }]);
    expect(count("jobs", "json_extract(payload_json, '$.courseId') = 'theirs'")).toBe(3);
    expect((await progress(tom)).total).toBeGreaterThan(0);
  });
});
