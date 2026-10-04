import { sql } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { freshDb, type Db } from "../../../../../tests/support/db.js";
import { SqliteAttemptRepository } from "./sqlite-attempt-repository.js";

// Deleting a confirmed course (decided on 2026-10-04): attempts survive
// their exercise; detached, they keep only what stars and the streak need.
const at = "2026-10-04T08:00:00.000Z";
const now = new Date("2026-10-04T10:00:00.000Z");

function seed(db: Db, userId: string, exerciseId: string): void {
  db.run(sql`INSERT OR IGNORE INTO accounts (id, username, password_hash, session_version, first_name, grade, created_at) VALUES (${userId}, ${`user-${userId}`}, 'x', 1, 'Léa', 'CM1', ${at})`);
  db.run(sql`INSERT INTO courses (id, user_id, title, grade, color, extraction_status, confirmed, created_at, last_accessed_at)
             VALUES (${`c-${exerciseId}`}, ${userId}, 'Le verbe', 'CM1', 'matiere-francais', 'ready', 1, ${at}, ${at})`);
  db.run(sql`INSERT INTO items (id, course_id, user_id, title, body, game_types_json, position, created_at) VALUES (${`i-${exerciseId}`}, ${`c-${exerciseId}`}, ${userId}, 't', 'b', '["mcq"]', 0, ${at})`);
  db.run(sql`INSERT INTO exercises (id, item_id, user_id, type, content_json, created_at) VALUES (${exerciseId}, ${`i-${exerciseId}`}, ${userId}, 'mcq', '{}', ${at})`);
}

describe("detached attempts", () => {
  let cleanup: (() => void) | undefined;
  afterEach(() => cleanup?.());

  function setup() {
    const fresh = freshDb();
    cleanup = fresh.cleanup;
    seed(fresh.db, "u1", "e1");
    seed(fresh.db, "u1", "e2");
    seed(fresh.db, "u2", "e3");
    return { db: fresh.db, repo: new SqliteAttemptRepository(fresh.db) };
  }

  it("detached and their course deleted, the attempts read the same for progress, without type or unit", async () => {
    const { db, repo } = setup();
    await repo.record("u1", [{ id: "a1", exerciseId: "e1", type: "mcq", unitId: "0", correct: true, starEligible: true }], now);
    await repo.record("u1", [{ id: "a2", exerciseId: "e2", type: "mcq", unitId: "0", correct: true, starEligible: true }], now);
    await repo.record("u2", [{ id: "a3", exerciseId: "e3", type: "mcq", unitId: "0", correct: true, starEligible: true }], now);
    const before = await repo.listByUser("u1");

    await repo.detach("u1", ["e1", "e3"]);
    db.run(sql`DELETE FROM courses WHERE id = 'c-e1'`);

    expect(await repo.listByUser("u1")).toEqual(before);
    expect(db.all(sql`SELECT id, type, unit_id FROM attempts ORDER BY id`)).toEqual([
      { id: "a1", type: null, unit_id: null },
      { id: "a2", type: "mcq", unit_id: "0" },
      // Another account's attempt is never touched.
      { id: "a3", type: "mcq", unit_id: "0" },
    ]);
  });

  it("an account's deletion still takes its detached attempts", async () => {
    const { db, repo } = setup();
    await repo.record("u1", [{ id: "a1", exerciseId: "e1", type: "mcq", unitId: "0", correct: true, starEligible: true }], now);
    await repo.detach("u1", ["e1"]);

    db.run(sql`DELETE FROM accounts WHERE id = 'u1'`);

    expect(db.all(sql`SELECT id FROM attempts`)).toEqual([]);
  });
});
