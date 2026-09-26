import { sql } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { freshDb, type Db } from "../../../../../tests/support/db.js";
import type { Attempt } from "../domain/ports.js";
import { SqliteAttemptRepository } from "./sqlite-attempt-repository.js";

const at = "2026-09-26T08:00:00.000Z";
const now = new Date("2026-09-26T10:00:00.000Z");

function seed(db: Db, userId: string, exerciseId: string): void {
  db.run(sql`INSERT OR IGNORE INTO accounts (id, username, password_hash, session_version, first_name, grade, created_at) VALUES (${userId}, ${`user-${userId}`}, 'x', 1, 'Léa', 'CM1', ${at})`);
  db.run(sql`INSERT INTO courses (id, user_id, title, grade, color, extraction_status, confirmed, created_at, last_accessed_at)
             VALUES (${`c-${exerciseId}`}, ${userId}, 'Le verbe', 'CM1', 'matiere-francais', 'ready', 1, ${at}, ${at})`);
  db.run(sql`INSERT INTO items (id, course_id, user_id, title, body, game_types_json, position, created_at) VALUES (${`i-${exerciseId}`}, ${`c-${exerciseId}`}, ${userId}, 't', 'b', '["matching"]', 0, ${at})`);
  db.run(sql`INSERT INTO exercises (id, item_id, user_id, type, content_json, created_at) VALUES (${exerciseId}, ${`i-${exerciseId}`}, ${userId}, 'matching', '{}', ${at})`);
}

const attempt = (id: string, exerciseId: string, unitId: string, correct: boolean): Attempt => ({ id, exerciseId, type: "matching", unitId, correct, starEligible: true });

describe("SqliteAttemptRepository", () => {
  let cleanup: (() => void) | undefined;
  afterEach(() => cleanup?.());

  function setup() {
    const fresh = freshDb();
    cleanup = fresh.cleanup;
    seed(fresh.db, "u1", "e1");
    seed(fresh.db, "u2", "e2");
    return { db: fresh.db, repo: new SqliteAttemptRepository(fresh.db) };
  }

  const count = (db: Db, where = "1 = 1") => db.get<{ n: number }>(sql.raw(`SELECT count(*) AS n FROM attempts WHERE ${where}`)).n;

  it("writes a four-pair matching as exactly four rows, reads them back only for their account", async () => {
    const { db, repo } = setup();

    await repo.record("u1", ["0", "1", "2", "3"].map((unit, i) => attempt(`a${unit}`, "e1", unit, i % 2 === 0)), now);

    expect(count(db)).toBe(4);
    expect(await repo.listForExercises("u1", ["e1"])).toEqual([
      { exerciseId: "e1", attemptedAt: now.toISOString(), correct: true, starEligible: true },
      { exerciseId: "e1", attemptedAt: now.toISOString(), correct: false, starEligible: true },
      { exerciseId: "e1", attemptedAt: now.toISOString(), correct: true, starEligible: true },
      { exerciseId: "e1", attemptedAt: now.toISOString(), correct: false, starEligible: true },
    ]);
    expect(await repo.listForExercises("u2", ["e1"])).toEqual([]);
    expect(await repo.listForExercises("u1", [])).toEqual([]);
  });

  it("stores no answer: only the result, the type, the exercise, the unit, the eligibility and the time", () => {
    const { db } = setup();

    const columns = db.all<{ name: string }>(sql`SELECT name FROM pragma_table_info('attempts')`).map((column) => column.name);

    expect(columns.sort()).toEqual(["attempted_at", "correct", "exercise_id", "id", "star_eligible", "type", "unit_id", "user_id"]);
  });

  it("writes a submission whole or not at all", async () => {
    const { db, repo } = setup();

    await expect(repo.record("u1", [attempt("a0", "e1", "0", true), attempt("a0", "e1", "1", true)], now)).rejects.toThrow();

    expect(count(db)).toBe(0);
  });

  it("never records an attempt on another account's exercise", async () => {
    const { db, repo } = setup();

    await expect(repo.record("u1", [attempt("a0", "e2", "0", true)], now)).rejects.toThrow();

    expect(count(db)).toBe(0);
  });

  it("deleting an account deletes its attempts, and only its own", async () => {
    const { db, repo } = setup();
    await repo.record("u1", [attempt("a1", "e1", "0", true)], now);
    await repo.record("u2", [attempt("a2", "e2", "0", true)], now);
    // An attempt of u1's on an exercise that outlives the account: only the
    // account's own cascade can remove it.
    db.run(sql`PRAGMA foreign_keys = OFF`);
    db.run(sql`INSERT INTO attempts (id, user_id, exercise_id, type, unit_id, correct, star_eligible, attempted_at) VALUES ('odd', 'u1', 'e2', 'matching', '0', 1, 1, ${at})`);
    db.run(sql`PRAGMA foreign_keys = ON`);

    db.run(sql`DELETE FROM accounts WHERE id = 'u1'`);

    expect(count(db, "user_id = 'u1'")).toBe(0);
    expect(count(db, "user_id = 'u2'")).toBe(1);
  });

  it("deleting an exercise deletes its attempts", async () => {
    const { db, repo } = setup();
    await repo.record("u1", [attempt("a1", "e1", "0", true)], now);

    db.run(sql`DELETE FROM exercises WHERE id = 'e1'`);

    expect(count(db)).toBe(0);
  });

  it("rejects an unknown game type at the database level", () => {
    const { db } = setup();

    expect(() => db.run(sql`INSERT INTO attempts (id, user_id, exercise_id, type, unit_id, correct, star_eligible, attempted_at) VALUES ('x', 'u1', 'e1', 'quiz', '0', 1, 1, ${at})`)).toThrow();
  });

  // M5: progress reads every attempt of an account, never another's.
  it("lists every attempt of an account, in order, for progress; none of another account", async () => {
    const { repo } = setup();
    await repo.record("u1", [attempt("a1", "e1", "0", true), attempt("a2", "e1", "1", false)], now);
    await repo.record("u1", [attempt("a3", "e1", "0", true)], new Date("2026-09-26T11:00:00.000Z"));
    await repo.record("u2", [attempt("a4", "e2", "0", true)], now);

    expect(await repo.listByUser("u1")).toEqual([
      { exerciseId: "e1", attemptedAt: now.toISOString(), correct: true, starEligible: true },
      { exerciseId: "e1", attemptedAt: now.toISOString(), correct: false, starEligible: true },
      { exerciseId: "e1", attemptedAt: "2026-09-26T11:00:00.000Z", correct: true, starEligible: true },
    ]);
    expect(await repo.listByUser("nobody")).toEqual([]);
  });
});
