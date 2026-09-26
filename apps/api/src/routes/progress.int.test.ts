import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Argon2PasswordHasher, createAccount, deriveProgress, PROGRESS_TIME_ZONE, SqliteAccountRepository, uuidV7Generator } from "@studiakids/core";
import { sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { openDatabase, type Db } from "../db/connection.js";
import { runMigrations } from "../db/migrate.js";

const PASSWORD = "correct-horse";
const AT = "2026-01-01T08:00:00.000Z";

// docs/modules/progress.md, API; docs/jalons.md, M5.
describe("progress routes", () => {
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

  // A course with `count` true-or-false exercises (answer: true).
  function seedCourse(username: string, count: number): { courseId: string; exercises: string[] } {
    const userId = db.get<{ id: string }>(sql`SELECT id FROM accounts WHERE username = ${username}`).id;
    const courseId = uuidV7Generator.next();
    db.run(sql`INSERT INTO courses (id, user_id, title, grade, color, extraction_status, confirmed, created_at, last_accessed_at)
               VALUES (${courseId}, ${userId}, 'Le verbe', 'CE2', 'matiere-francais', 'ready', 1, ${AT}, ${AT})`);
    db.run(sql`INSERT INTO extractions (course_id, markdown, extracted_at) VALUES (${courseId}, '# Le verbe', ${AT})`);
    const exercises = Array.from({ length: count }, (_, position) => {
      const itemId = uuidV7Generator.next();
      const exerciseId = uuidV7Generator.next();
      db.run(sql`INSERT INTO items (id, course_id, user_id, title, body, game_types_json, position, created_at) VALUES (${itemId}, ${courseId}, ${userId}, ${`Point ${String(position)}`}, 'b', '["true_false"]', ${position}, ${AT})`);
      db.run(sql`INSERT INTO exercises (id, item_id, user_id, type, content_json, created_at) VALUES (${exerciseId}, ${itemId}, ${userId}, 'true_false', ${JSON.stringify({ type: "true_false", statement: "Vrai.", answer: true })}, ${AT})`);
      return exerciseId;
    });
    return { courseId, exercises };
  }

  const answer = (exerciseId: string, value: boolean, cookie = lea, reread = false) =>
    app.inject({ method: "POST", url: `/api/exercises/${exerciseId}/answer`, headers: { cookie }, payload: { givenAnswer: { value }, reread } });
  const progress = (cookie = lea, query = "") => app.inject({ method: "GET", url: `/api/progress${query}`, headers: { cookie } });

  // What deriveProgress makes of the rows actually stored for an account.
  function derivedFromStoredRows(username: string): number {
    const rows = db.all<{ exercise_id: string; attempted_at: string; correct: number; star_eligible: number }>(
      sql`SELECT a.exercise_id, a.attempted_at, a.correct, a.star_eligible FROM attempts a JOIN accounts u ON u.id = a.user_id WHERE u.username = ${username}`,
    );
    return deriveProgress(
      rows.map((row) => ({ exerciseId: row.exercise_id, attemptedAt: row.attempted_at, correct: row.correct === 1, starEligible: row.star_eligible === 1 })),
      PROGRESS_TIME_ZONE,
    ).total;
  }

  beforeEach(async () => {
    volume = mkdtempSync(path.join(tmpdir(), "studiakids-api-progress-"));
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

  it("a new account has no star and no streak", async () => {
    const res = await progress();

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ total: 0, currentStreak: 0, bestStreak: 0 });
  });

  it("each answer brings the new total and streak; a wrong answer takes nothing back; the fifth in a row brings the bonus and the dance", async () => {
    const { exercises } = seedCourse("lea", 6);
    const seen: unknown[] = [];

    for (const [i, exerciseId] of exercises.slice(0, 2).entries()) seen.push((await answer(exerciseId, true)).json<{ progress: unknown }>().progress, i);
    const miss = (await answer(exercises[2]!, false)).json<{ progress: { total: number; currentStreak: number } }>().progress;
    expect(miss).toEqual({ total: 2, currentStreak: 0, bestStreak: 2, stars: 0, celebrate: null });
    const comeback = (await answer(exercises[2]!, true)).json<{ progress: unknown }>().progress;
    expect(comeback).toEqual({ total: 3, currentStreak: 1, bestStreak: 2, stars: 1, celebrate: "comeback" });
    for (const exerciseId of exercises.slice(3, 6)) await answer(exerciseId, true);
    const fifth = (await answer(exercises[0]!, true)).json<{ progress: unknown }>().progress;

    // Already rewarded today: no star of its own, but it extends the streak to 5.
    expect(fifth).toEqual({ total: 7, currentStreak: 5, bestStreak: 5, stars: 1, celebrate: "streak-bonus" });
    expect(seen).toEqual([
      { total: 1, currentStreak: 1, bestStreak: 1, stars: 1, celebrate: null },
      0,
      { total: 2, currentStreak: 2, bestStreak: 2, stars: 1, celebrate: null },
      1,
    ]);
  });

  it("the total the API exposes is exactly what the stored attempts derive to, never a counter of its own", async () => {
    const { exercises } = seedCourse("lea", 4);
    for (const [exerciseId, value, reread] of [
      [exercises[0], true, false],
      [exercises[1], false, false],
      [exercises[1], true, true],
      [exercises[2], true, false],
      [exercises[0], true, false],
      [exercises[3], true, false],
    ] as const) {
      await answer(exerciseId!, value, lea, reread);
      expect((await progress()).json<{ total: number }>().total).toBe(derivedFromStoredRows("lea"));
    }
    expect(derivedFromStoredRows("lea")).toBe(3);
    const columns = db.all<{ name: string }>(sql`SELECT name FROM pragma_table_info('accounts')`).map((column) => column.name);
    expect(columns.some((name) => /star|streak|total/.test(name))).toBe(false);
  });

  it("with since: the session's stars and right answers", async () => {
    const { exercises } = seedCourse("lea", 3);
    await answer(exercises[0]!, true);
    const since = new Date(Date.now() + 5).toISOString();
    await new Promise((resolve) => setTimeout(resolve, 10));
    await answer(exercises[1]!, false);
    await answer(exercises[1]!, true);
    await answer(exercises[2]!, true, lea, true);

    const res = await progress(lea, `?since=${encodeURIComponent(since)}`);

    expect(res.json()).toEqual({ total: 2, currentStreak: 1, bestStreak: 1, starsSince: 1, successesSince: 2 });
  });

  it("an account's counters never include another account's attempts", async () => {
    const { exercises } = seedCourse("lea", 2);
    const theirs = seedCourse("tom", 1);
    await answer(exercises[0]!, true);
    await answer(exercises[1]!, true);
    await answer(theirs.exercises[0]!, true, tom);

    expect((await progress(lea)).json()).toMatchObject({ total: 2 });
    expect((await progress(tom)).json()).toMatchObject({ total: 1 });
  });

  it("opening Jouer records the course as the last one opened", async () => {
    const { courseId } = seedCourse("lea", 1);

    await app.inject({ method: "GET", url: `/api/courses/${courseId}/exercises`, headers: { cookie: lea } });

    expect(db.get<{ at: string }>(sql`SELECT last_accessed_at AS at FROM courses WHERE id = ${courseId}`).at > AT).toBe(true);
  });
});
