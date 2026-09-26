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
const AT = "2026-09-26T08:00:00.000Z";

const MCQ = { type: "mcq", question: "Que fait le verbe ?", options: ["Il indique l'action", "Il nomme", "Il décrit", "Il relie"], answer: "Il indique l'action" };
const MATCHING = {
  type: "matching",
  pairs: [
    { left: "Hier", right: "Léa chantait" },
    { left: "Aujourd'hui", right: "Léa chante" },
    { left: "Demain", right: "Léa chantera" },
  ],
};
const COPY = { type: "delayed_copy", wordOrPhrase: "chanter" };

// docs/modules/game-engine.md, API.
describe("play routes", () => {
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

  // A course with its items and exercises, as the generation left them.
  function seedCourse(username: string, options: { confirmed?: boolean } = {}): { courseId: string; ids: Record<string, string> } {
    const userId = db.get<{ id: string }>(sql`SELECT id FROM accounts WHERE username = ${username}`).id;
    const courseId = uuidV7Generator.next();
    db.run(sql`INSERT INTO courses (id, user_id, title, grade, color, extraction_status, confirmed, created_at, last_accessed_at)
               VALUES (${courseId}, ${userId}, 'Le verbe', 'CE2', 'matiere-francais', 'ready', ${options.confirmed === false ? 0 : 1}, ${AT}, ${AT})`);
    db.run(sql`INSERT INTO extractions (course_id, markdown, extracted_at) VALUES (${courseId}, '# Le verbe', ${AT})`);
    const ids: Record<string, string> = {};
    [
      ["Le rôle du verbe", MCQ],
      ["Les temps", MATCHING],
      ["Infinitif : chanter", COPY],
    ].forEach(([title, content], position) => {
      const itemId = uuidV7Generator.next();
      const exerciseId = uuidV7Generator.next();
      const type = (content as { type: string }).type;
      ids[type] = exerciseId;
      db.run(sql`INSERT INTO items (id, course_id, user_id, title, body, game_types_json, position, created_at)
                 VALUES (${itemId}, ${courseId}, ${userId}, ${title as string}, 'b', ${JSON.stringify([type])}, ${position}, ${AT})`);
      db.run(sql`INSERT INTO exercises (id, item_id, user_id, type, content_json, created_at) VALUES (${exerciseId}, ${itemId}, ${userId}, ${type}, ${JSON.stringify(content)}, ${AT})`);
    });
    return { courseId, ids };
  }

  const attempts = () => db.all<{ exercise_id: string; unit_id: string; correct: number; star_eligible: number }>(sql`SELECT exercise_id, unit_id, correct, star_eligible FROM attempts ORDER BY unit_id`);
  const answer = (exerciseId: string, payload: unknown, cookie = lea) => app.inject({ method: "POST", url: `/api/exercises/${exerciseId}/answer`, headers: { cookie }, payload: payload as object });

  beforeEach(async () => {
    volume = mkdtempSync(path.join(tmpdir(), "studiakids-api-play-"));
    const dbPath = path.join(volume, "test.db");
    db = openDatabase(dbPath);
    runMigrations(db);
    const accounts = { accountRepository: new SqliteAccountRepository(db), passwordHasher: new Argon2PasswordHasher(), idGenerator: uuidV7Generator };
    await createAccount(accounts, "lea", PASSWORD, "Léa", "CE2", new Date());
    await createAccount(accounts, "tom", PASSWORD, "Tom", "CM2", new Date());
    app = buildApp({ databasePath: dbPath, dataDir: volume, sessionSecret: "test-session-secret", cookieSecure: false });
    lea = await login("lea");
    tom = await login("tom");
  });

  afterEach(async () => {
    await app.close();
    rmSync(volume, { recursive: true, force: true });
  });

  it("GET /api/courses/:id/exercises lists the playable views in the course's order, never an answer, and the next one", async () => {
    const { courseId, ids } = seedCourse("lea");

    const res = await app.inject({ method: "GET", url: `/api/courses/${courseId}/exercises`, headers: { cookie: lea } });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ exercises: Record<string, unknown>[]; nextExerciseId: string }>();
    expect(body.exercises.map((e) => [e.type, e.itemTitle])).toEqual([
      ["mcq", "Le rôle du verbe"],
      ["matching", "Les temps"],
      ["delayed_copy", "Infinitif : chanter"],
    ]);
    for (const exercise of body.exercises) for (const key of ["answer", "blanks", "pairs", "content"]) expect(exercise).not.toHaveProperty(key);
    expect(body.exercises[1]).toMatchObject({ lefts: ["Hier", "Aujourd'hui", "Demain"] });
    expect(body.exercises[2]).toMatchObject({ wordOrPhrase: "chanter", displayDurationMs: 3500 });
    expect(body.nextExerciseId).toBe(ids.mcq);
  });

  it("POST /api/exercises/:id/answer compares, writes one attempt per unit, never the answer nor a change to the exercise", async () => {
    const { ids } = seedCourse("lea");
    const before = db.all(sql`SELECT * FROM exercises ORDER BY id`);
    const given = { pairs: [{ left: "Demain", right: "Léa chantera" }, { left: "Hier", right: "Léa chante" }, { left: "Aujourd'hui", right: "Léa chantait" }] };

    const res = await answer(ids.matching!, { givenAnswer: given });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ result: { units: [{ id: "0", correct: false }, { id: "1", correct: false }, { id: "2", correct: true }] } });
    expect(attempts()).toEqual([
      { exercise_id: ids.matching, unit_id: "0", correct: 0, star_eligible: 1 },
      { exercise_id: ids.matching, unit_id: "1", correct: 0, star_eligible: 1 },
      { exercise_id: ids.matching, unit_id: "2", correct: 1, star_eligible: 1 },
    ]);
    expect(JSON.stringify(db.all(sql`SELECT * FROM attempts`))).not.toContain("Léa");
    expect(db.all(sql`SELECT * FROM exercises ORDER BY id`)).toEqual(before);
  });

  it("a reread keeps the result faithful and writes no success event; the next exercise stays the same", async () => {
    const { courseId, ids } = seedCourse("lea");
    await answer(ids.mcq!, { givenAnswer: { chosenOption: "Il indique l'action" } });

    const res = await answer(ids.delayed_copy!, { givenAnswer: { text: "chanter" }, reread: true });

    expect(res.json()).toEqual({ result: { units: [{ id: "0", correct: true }] } });
    expect(attempts().filter((a) => a.exercise_id === ids.delayed_copy)).toEqual([{ exercise_id: ids.delayed_copy, unit_id: "0", correct: 1, star_eligible: 0 }]);
    const list = await app.inject({ method: "GET", url: `/api/courses/${courseId}/exercises`, headers: { cookie: lea } });
    expect(list.json()).toMatchObject({ nextExerciseId: ids.matching });
  });

  it("an answer shaped for another type is refused with 400 invalid_answer, and nothing is written", async () => {
    const { ids } = seedCourse("lea");

    for (const payload of [{ givenAnswer: { value: true } }, { givenAnswer: "chanter" }, {}]) {
      const res = await answer(ids.delayed_copy!, payload);
      expect(res.statusCode).toBe(400);
      expect(res.json()).toEqual({ error: "invalid_answer" });
    }
    expect(attempts()).toEqual([]);
  });

  it("a course not confirmed yet cannot be played: 409 not_ready", async () => {
    const { courseId } = seedCourse("lea", { confirmed: false });

    const res = await app.inject({ method: "GET", url: `/api/courses/${courseId}/exercises`, headers: { cookie: lea } });

    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: "not_ready" });
  });

  // Security (docs/securite.md): another account's course or exercise
  // answers exactly like an unknown id, and nothing is written.
  describe("another account's course or exercise answers exactly like an unknown id", () => {
    const comparable = (headers: Record<string, unknown>) => {
      const { date: _date, "set-cookie": _cookie, ...rest } = headers;
      return rest;
    };

    it("list: 404, same body and headers", async () => {
      const { courseId } = seedCourse("lea");
      const other = await app.inject({ method: "GET", url: `/api/courses/${courseId}/exercises`, headers: { cookie: tom } });
      const unknown = await app.inject({ method: "GET", url: `/api/courses/${uuidV7Generator.next()}/exercises`, headers: { cookie: tom } });

      expect(other.statusCode).toBe(404);
      expect(other.body).toBe(unknown.body);
      expect(comparable(other.headers)).toEqual(comparable(unknown.headers));
    });

    it("answer: 404, same body and headers, and no attempt for anyone", async () => {
      const { ids } = seedCourse("lea");
      const other = await answer(ids.mcq!, { givenAnswer: { chosenOption: "Il indique l'action" } }, tom);
      const unknown = await answer(uuidV7Generator.next(), { givenAnswer: { chosenOption: "Il indique l'action" } }, tom);

      expect(other.statusCode).toBe(404);
      expect(other.body).toBe(unknown.body);
      expect(comparable(other.headers)).toEqual(comparable(unknown.headers));
      expect(attempts()).toEqual([]);
    });
  });
});
