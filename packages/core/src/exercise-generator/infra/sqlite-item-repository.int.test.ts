import { sql } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { freshDb, type Db } from "../../../../../tests/support/db.js";
import type { Exercise, Item } from "../domain/ports.js";
import { SqliteItemRepository } from "./sqlite-item-repository.js";

const now = new Date("2026-09-26T10:00:00.000Z");

function seed(db: Db, userId: string, courseId: string): void {
  db.run(sql`INSERT OR IGNORE INTO accounts (id, username, password_hash, session_version, first_name, grade, created_at)
             VALUES (${userId}, ${`user-${userId}`}, 'x', 1, 'Léa', 'CM1', ${now.toISOString()})`);
  db.run(sql`INSERT INTO courses (id, user_id, title, grade, color, extraction_status, confirmed, created_at, last_accessed_at)
             VALUES (${courseId}, ${userId}, 'Le château', 'CM1', 'matiere-histoire', 'ready', 1, ${now.toISOString()}, ${now.toISOString()})`);
}

const item = (id: string, courseId: string, userId: string, position: number): Item => ({
  id,
  courseId,
  userId,
  title: `Item ${id}`,
  body: "Le donjon est la tour la plus haute.",
  applicableGameTypes: ["mcq", "true_false"],
  position,
  createdAt: now.toISOString(),
});
const exercise = (id: string, itemId: string, userId: string, statement = "Le donjon est haut."): Exercise => ({
  id,
  itemId,
  userId,
  type: "true_false",
  content: { type: "true_false", statement, answer: true },
  createdAt: now.toISOString(),
});

describe("SqliteItemRepository", () => {
  let cleanup: (() => void) | undefined;
  afterEach(() => cleanup?.());

  function setup() {
    const fresh = freshDb();
    cleanup = fresh.cleanup;
    seed(fresh.db, "u1", "c1");
    seed(fresh.db, "u2", "c2");
    return { db: fresh.db, repo: new SqliteItemRepository(fresh.db) };
  }

  it("saves a split (items and outcome) and reads it back by position, only for the owner", async () => {
    const { repo } = setup();
    await repo.saveSplit("u1", "c1", { items: [item("i1", "c1", "u1", 1), item("i0", "c1", "u1", 0)], outcome: "items_ready", itemCount: 2 }, now);

    expect((await repo.listItems("u1", "c1")).map((i) => [i.id, i.position, i.applicableGameTypes])).toEqual([
      ["i0", 0, ["mcq", "true_false"]],
      ["i1", 1, ["mcq", "true_false"]],
    ]);
    expect(await repo.findSplitOutcome("u1", "c1")).toEqual({ outcome: "items_ready", itemCount: 2 });
    expect(await repo.listItems("u2", "c1")).toEqual([]);
    expect(await repo.findSplitOutcome("u2", "c1")).toBeNull();
    expect(await repo.findItem("u1", "i0")).toMatchObject({ id: "i0", courseId: "c1" });
    expect(await repo.findItem("u2", "i0")).toBeNull();
  });

  it("never writes a split on another account's course", async () => {
    const { repo } = setup();

    await repo.saveSplit("u2", "c1", { items: [item("x", "c1", "u2", 0)], outcome: "items_ready", itemCount: 1 }, now);

    expect(await repo.listItems("u1", "c1")).toEqual([]);
    expect(await repo.findSplitOutcome("u1", "c1")).toBeNull();
  });

  it("an insufficient split stores its outcome and the count, with no item", async () => {
    const { repo } = setup();

    await repo.saveSplit("u1", "c1", { items: [], outcome: "insufficient_coverage", itemCount: 5 }, now);

    expect(await repo.findSplitOutcome("u1", "c1")).toEqual({ outcome: "insufficient_coverage", itemCount: 5 });
  });

  it("a new split replaces the course's items, their exercises with them", async () => {
    const { repo } = setup();
    await repo.saveSplit("u1", "c1", { items: [item("i0", "c1", "u1", 0)], outcome: "items_ready", itemCount: 1 }, now);
    await repo.applyExercises("u1", { remove: [], insert: [exercise("e0", "i0", "u1")] });

    await repo.saveSplit("u1", "c1", { items: [item("j0", "c1", "u1", 0)], outcome: "items_ready", itemCount: 1 }, now);

    expect((await repo.listItems("u1", "c1")).map((i) => i.id)).toEqual(["j0"]);
    expect(await repo.listExercises("u1", ["i0"])).toEqual([]);
  });

  it("applies exercises in one transaction: removed first, then inserted, filtered by type", async () => {
    const { repo } = setup();
    await repo.saveSplit("u1", "c1", { items: [item("i0", "c1", "u1", 0), item("i1", "c1", "u1", 1)], outcome: "items_ready", itemCount: 2 }, now);
    await repo.applyExercises("u1", { remove: [], insert: [exercise("e0", "i0", "u1"), exercise("e1", "i1", "u1")] });

    await repo.applyExercises("u1", { remove: ["e0"], insert: [exercise("e2", "i0", "u1", "Autre phrase.")] });

    expect((await repo.listExercises("u1", ["i0", "i1"], "true_false")).map((e) => e.id).sort()).toEqual(["e1", "e2"]);
    expect(await repo.listExercises("u1", ["i0"], "mcq")).toEqual([]);
    expect(await repo.listExercises("u2", ["i0"])).toEqual([]);
  });

  it("never holds two exercises of the same type for an item, and rolls a failed change back whole", async () => {
    const { repo } = setup();
    await repo.saveSplit("u1", "c1", { items: [item("i0", "c1", "u1", 0)], outcome: "items_ready", itemCount: 1 }, now);
    await repo.applyExercises("u1", { remove: [], insert: [exercise("e0", "i0", "u1")] });

    await expect(repo.applyExercises("u1", { remove: [], insert: [exercise("e1", "i0", "u1")] })).rejects.toThrow();
    await expect(repo.applyExercises("u1", { remove: ["e0"], insert: [exercise("e2", "i0", "u1"), exercise("e3", "i0", "u1")] })).rejects.toThrow();

    expect((await repo.listExercises("u1", ["i0"])).map((e) => e.id)).toEqual(["e0"]);
  });

  it("counts exercises per course, only the owner's", async () => {
    const { repo } = setup();
    await repo.saveSplit("u1", "c1", { items: [item("i0", "c1", "u1", 0), item("i1", "c1", "u1", 1)], outcome: "items_ready", itemCount: 2 }, now);
    await repo.applyExercises("u1", { remove: [], insert: [exercise("e0", "i0", "u1"), exercise("e1", "i1", "u1")] });

    expect(await repo.countExercisesByCourse("u1")).toEqual({ c1: 2 });
    expect(await repo.countExercisesByCourse("u2")).toEqual({});
  });

  // Decided at M3's opening: deleting an account deletes its items,
  // exercises and split outcomes (ON DELETE CASCADE on user_id).
  it("deleting an account deletes its items, exercises and split outcomes, and no one else's", async () => {
    const { db, repo } = setup();
    await repo.saveSplit("u1", "c1", { items: [item("i0", "c1", "u1", 0)], outcome: "items_ready", itemCount: 1 }, now);
    await repo.applyExercises("u1", { remove: [], insert: [exercise("e0", "i0", "u1")] });
    await repo.saveSplit("u2", "c2", { items: [item("k0", "c2", "u2", 0)], outcome: "items_ready", itemCount: 1 }, now);

    db.run(sql`DELETE FROM accounts WHERE id = 'u1'`);

    const count = (table: string) => db.get<{ n: number }>(sql.raw(`SELECT count(*) AS n FROM ${table} WHERE user_id = 'u1'`)).n;
    expect([count("items"), count("exercises"), count("course_generations")]).toEqual([0, 0, 0]);
    expect((await repo.listItems("u2", "c2")).map((i) => i.id)).toEqual(["k0"]);
  });

  // The cascade on user_id holds on its own, not only through the course's:
  // a row whose course belongs to another account still goes with its own
  // account (defence in depth, decided at M3's opening).
  it("user_id cascades on its own, even for rows on another account's course", () => {
    const { db } = setup();
    db.run(sql`INSERT INTO items (id, course_id, user_id, title, body, game_types_json, position, created_at) VALUES ('odd', 'c2', 'u1', 't', 'b', '["mcq"]', 0, 'x')`);
    db.run(sql`INSERT INTO items (id, course_id, user_id, title, body, game_types_json, position, created_at) VALUES ('i-u2', 'c2', 'u2', 't', 'b', '["mcq"]', 1, 'x')`);
    db.run(sql`INSERT INTO exercises (id, item_id, user_id, type, content_json, created_at) VALUES ('odd-e', 'i-u2', 'u1', 'mcq', '{}', 'x')`);
    db.run(sql`INSERT INTO course_generations (course_id, user_id, split_outcome, item_count, updated_at) VALUES ('c2', 'u1', 'items_ready', 1, 'x')`);

    db.run(sql`DELETE FROM accounts WHERE id = 'u1'`);

    const count = (table: string) => db.get<{ n: number }>(sql.raw(`SELECT count(*) AS n FROM ${table} WHERE user_id = 'u1'`)).n;
    expect([count("items"), count("exercises"), count("course_generations")]).toEqual([0, 0, 0]);
    expect(db.get<{ n: number }>(sql`SELECT count(*) AS n FROM items WHERE id = 'i-u2'`).n).toBe(1);
  });

  it("deleting a course deletes its items, exercises and split outcome", async () => {
    const { db, repo } = setup();
    await repo.saveSplit("u1", "c1", { items: [item("i0", "c1", "u1", 0)], outcome: "items_ready", itemCount: 1 }, now);
    await repo.applyExercises("u1", { remove: [], insert: [exercise("e0", "i0", "u1")] });

    db.run(sql`DELETE FROM courses WHERE id = 'c1'`);

    const count = (table: string) => db.get<{ n: number }>(sql.raw(`SELECT count(*) AS n FROM ${table}`)).n;
    expect([count("items"), count("exercises"), count("course_generations")]).toEqual([0, 0, 0]);
  });

  it("rejects an unknown game type at the database level", () => {
    const { db } = setup();
    db.run(sql`INSERT INTO items (id, course_id, user_id, title, body, game_types_json, position, created_at) VALUES ('i9', 'c1', 'u1', 't', 'b', '[]', 0, 'x')`);

    expect(() => db.run(sql`INSERT INTO exercises (id, item_id, user_id, type, content_json, created_at) VALUES ('e9', 'i9', 'u1', 'quiz', '{}', 'x')`)).toThrow();
  });

  // M4: game-engine reads one exercise by its id, always for its owner.
  it("finds one exercise by its id, only for its owner", async () => {
    const { repo } = setup();
    await repo.saveSplit("u1", "c1", { items: [item("i0", "c1", "u1", 0)], outcome: "items_ready", itemCount: 1 }, now);
    await repo.applyExercises("u1", { remove: [], insert: [exercise("e0", "i0", "u1")] });

    expect(await repo.findExercise("u1", "e0")).toMatchObject({ id: "e0", itemId: "i0", type: "true_false", content: { type: "true_false", answer: true } });
    expect(await repo.findExercise("u2", "e0")).toBeNull();
    expect(await repo.findExercise("u1", "nope")).toBeNull();
  });
});
