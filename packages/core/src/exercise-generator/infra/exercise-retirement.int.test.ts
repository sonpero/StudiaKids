import { sql } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { freshDb, type Db } from "../../../../../tests/support/db.js";
import type { Exercise, Item } from "../domain/ports.js";
import { SqliteItemRepository } from "./sqlite-item-repository.js";

// Stars are derived from the attempts (docs/modules/progress.md), and an
// exercise's attempts go with it (ON DELETE CASCADE): an exercise that was
// played is never deleted. Replaced, it stays as it is; removed, it is
// retired — kept, hidden from every list.
const now = new Date("2026-10-04T10:00:00.000Z");

function seed(db: Db): void {
  db.run(sql`INSERT INTO accounts (id, username, password_hash, session_version, first_name, grade, created_at)
             VALUES ('u1', 'lea', 'x', 1, 'Léa', 'CE2', ${now.toISOString()})`);
  db.run(sql`INSERT INTO courses (id, user_id, title, subject, grade, color, extraction_status, confirmed, created_at, last_accessed_at)
             VALUES ('c1', 'u1', 'La table de 7', 'maths', 'CE2', 'matiere-maths', 'ready', 1, ${now.toISOString()}, ${now.toISOString()})`);
}

const item = (id: string, position: number): Item => ({ id, courseId: "c1", userId: "u1", title: `Item ${id}`, body: "7 × 2 = 14", applicableGameTypes: ["cloze", "delayed_copy"], position, createdAt: now.toISOString() });
const copy = (id: string, itemId: string): Exercise => ({ id, itemId, userId: "u1", type: "delayed_copy", content: { type: "delayed_copy", wordOrPhrase: "produit" }, createdAt: now.toISOString() });
const cloze = (id: string, itemId: string, blank: string): Exercise => ({ id, itemId, userId: "u1", type: "cloze", content: { type: "cloze", text: "7 × 2 = {{0}}", blanks: [blank] }, createdAt: now.toISOString() });

function played(db: Db, exerciseId: string, type: string): void {
  db.run(sql`INSERT INTO attempts (id, user_id, exercise_id, type, unit_id, correct, star_eligible, attempted_at)
             VALUES (${`a-${exerciseId}`}, 'u1', ${exerciseId}, ${type}, '0', 1, 1, ${now.toISOString()})`);
}

const attempts = (db: Db) => db.all<{ exercise_id: string }>(sql`SELECT exercise_id FROM attempts ORDER BY exercise_id`).map((row) => row.exercise_id);
const rows = (db: Db) => db.all<{ id: string; retired: number }>(sql`SELECT id, retired FROM exercises ORDER BY id`);

describe("an exercise that was played is never deleted", () => {
  let cleanup: (() => void) | undefined;
  afterEach(() => cleanup?.());

  async function setup() {
    const fresh = freshDb();
    cleanup = fresh.cleanup;
    seed(fresh.db);
    const repo = new SqliteItemRepository(fresh.db);
    await repo.saveSplit("u1", "c1", { items: [item("i0", 0), item("i1", 1)], outcome: "items_ready", itemCount: 2 }, now);
    return { db: fresh.db, repo };
  }

  it("removed after being played: retired, its attempts kept, gone from every list", async () => {
    const { db, repo } = await setup();
    await repo.applyExercises("u1", { remove: [], insert: [copy("e-played", "i0"), copy("e-new", "i1")] });
    played(db, "e-played", "delayed_copy");

    await repo.applyExercises("u1", { remove: ["e-played", "e-new"], insert: [] });

    expect(rows(db)).toEqual([{ id: "e-played", retired: 1 }]);
    expect(attempts(db)).toEqual(["e-played"]);
    expect(await repo.findExercise("u1", "e-played")).toBeNull();
    expect(await repo.listExercises("u1", ["i0", "i1"])).toEqual([]);
    expect(await repo.countExercisesByCourse("u1")).toEqual({});
  });

  it("replaced after being played: kept as it is, the new one not written", async () => {
    const { db, repo } = await setup();
    await repo.applyExercises("u1", { remove: [], insert: [cloze("e-played", "i0", "14"), cloze("e-new", "i1", "14")] });
    played(db, "e-played", "cloze");

    await repo.applyExercises("u1", { remove: ["e-played", "e-new"], insert: [cloze("e-played-2", "i0", "15"), cloze("e-new-2", "i1", "15")] });

    expect(rows(db)).toEqual([
      { id: "e-new-2", retired: 0 },
      { id: "e-played", retired: 0 },
    ]);
    expect((await repo.findExercise("u1", "e-played"))?.content).toEqual(cloze("e-played", "i0", "14").content);
    expect(attempts(db)).toEqual(["e-played"]);
  });

  it("a slot held by a retired exercise takes no new one, without failing the rest", async () => {
    const { db, repo } = await setup();
    await repo.applyExercises("u1", { remove: [], insert: [cloze("e-word", "i0", "produit")] });
    played(db, "e-word", "cloze");
    await repo.applyExercises("u1", { remove: ["e-word"], insert: [] });

    await repo.applyExercises("u1", { remove: [], insert: [cloze("e-number", "i0", "14"), cloze("e-other", "i1", "14")] });

    expect(rows(db)).toEqual([
      { id: "e-other", retired: 0 },
      { id: "e-word", retired: 1 },
    ]);
  });

  it("an exercise never played is still deleted", async () => {
    const { db, repo } = await setup();
    await repo.applyExercises("u1", { remove: [], insert: [copy("e0", "i0")] });

    await repo.applyExercises("u1", { remove: ["e0"], insert: [] });

    expect(rows(db)).toEqual([]);
  });

  // Since 2026-10-04 the attempts outlive their course (detached, for the
  // stars, docs/modules/game-engine.md); the exercises still go.
  it("deleting the course still takes every exercise with it, never the attempts", async () => {
    const { db, repo } = await setup();
    await repo.applyExercises("u1", { remove: [], insert: [copy("e-played", "i0")] });
    played(db, "e-played", "delayed_copy");
    await repo.applyExercises("u1", { remove: ["e-played"], insert: [] });

    db.run(sql`DELETE FROM courses WHERE id = 'c1'`);

    expect(rows(db)).toEqual([]);
    expect(attempts(db)).toEqual(["e-played"]);
  });

  // Deleting a confirmed course (2026-10-04): its attempts are detached
  // first, retired exercises' included.
  it("lists every exercise id of a course, retired ones included, only for its owner", async () => {
    const { db, repo } = await setup();
    await repo.applyExercises("u1", { remove: [], insert: [copy("e-played", "i0"), cloze("e-live", "i1", "14")] });
    played(db, "e-played", "delayed_copy");
    await repo.applyExercises("u1", { remove: ["e-played"], insert: [] });

    expect((await repo.listCourseExerciseIds("u1", "c1")).sort()).toEqual(["e-live", "e-played"]);
    expect(await repo.listCourseExerciseIds("u2", "c1")).toEqual([]);
  });
});
