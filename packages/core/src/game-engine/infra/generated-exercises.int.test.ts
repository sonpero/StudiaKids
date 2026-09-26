import { sql } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { freshDb, type Db } from "../../../../../tests/support/db.js";
import { IngestionCourseTexts, SqliteItemRepository } from "../../exercise-generator/index.js";
import { SqliteCourseRepository } from "../../ingestion/index.js";
import { ok } from "../../shared/index.js";
import { GeneratedExercises } from "./generated-exercises.js";

const at = "2026-09-26T08:00:00.000Z";

function seedCourse(db: Db, userId: string, courseId: string, confirmed = true): void {
  db.run(sql`INSERT OR IGNORE INTO accounts (id, username, password_hash, session_version, first_name, grade, created_at) VALUES (${userId}, ${`user-${userId}`}, 'x', 1, 'Léa', 'CM1', ${at})`);
  db.run(sql`INSERT INTO courses (id, user_id, title, grade, color, extraction_status, confirmed, created_at, last_accessed_at)
             VALUES (${courseId}, ${userId}, 'Le verbe', 'CM1', 'matiere-francais', 'ready', ${confirmed ? 1 : 0}, ${at}, ${at})`);
  db.run(sql`INSERT INTO extractions (course_id, markdown, extracted_at) VALUES (${courseId}, '# Le verbe', ${at})`);
}
function seedItem(db: Db, userId: string, courseId: string, itemId: string, position: number, title: string): void {
  db.run(sql`INSERT INTO items (id, course_id, user_id, title, body, game_types_json, position, created_at) VALUES (${itemId}, ${courseId}, ${userId}, ${title}, 'b', '["mcq"]', ${position}, ${at})`);
}
function seedExercise(db: Db, userId: string, itemId: string, id: string, content: Record<string, unknown> & { type: string }): void {
  db.run(sql`INSERT INTO exercises (id, item_id, user_id, type, content_json, created_at) VALUES (${id}, ${itemId}, ${userId}, ${content.type}, ${JSON.stringify(content)}, ${at})`);
}

// game-engine reads exercise-generator's exercises through its index only.
describe("GeneratedExercises", () => {
  let cleanup: (() => void) | undefined;
  afterEach(() => cleanup?.());

  function setup() {
    const fresh = freshDb();
    cleanup = fresh.cleanup;
    const repo = new SqliteItemRepository(fresh.db);
    return { db: fresh.db, source: new GeneratedExercises(repo, new IngestionCourseTexts(new SqliteCourseRepository(fresh.db))) };
  }

  it("lists a course's exercises by item position, then in the game types' order, with each item's title", async () => {
    const { db, source } = setup();
    seedCourse(db, "u1", "c1");
    seedItem(db, "u1", "c1", "i-second", 1, "Deuxième");
    seedItem(db, "u1", "c1", "i-first", 0, "Premier");
    seedExercise(db, "u1", "i-second", "e-tf", { type: "true_false", statement: "Vrai.", answer: true });
    seedExercise(db, "u1", "i-first", "e-a-cloze", { type: "cloze", text: "Le {{0}}.", blanks: ["verbe"] });
    seedExercise(db, "u1", "i-first", "e-b-mcq", { type: "mcq", question: "?", options: ["a", "b", "c", "d"], answer: "a" });

    const listed = await source.listCourseExercises("u1", "c1");

    if (!listed.ok) throw new Error(listed.error);
    // Ids, insertion and the (item, type) index all put the cloze first: only the game types' order puts the question first.
    expect(listed.value.map(({ exercise, itemTitle }) => [exercise.id, itemTitle])).toEqual([
      ["e-b-mcq", "Premier"],
      ["e-a-cloze", "Premier"],
      ["e-tf", "Deuxième"],
    ]);
  });

  it("an empty course lists nothing; another account's course is not found; an unconfirmed one is not ready", async () => {
    const { db, source } = setup();
    seedCourse(db, "u1", "c-empty");
    seedCourse(db, "u2", "c-theirs");
    seedCourse(db, "u1", "c-pending", false);

    expect(await source.listCourseExercises("u1", "c-empty")).toEqual(ok([]));
    expect(await source.listCourseExercises("u1", "c-theirs")).toEqual({ ok: false, error: "not-found" });
    expect(await source.listCourseExercises("u1", "c-pending")).toEqual({ ok: false, error: "not-ready" });
  });

  it("finds one exercise only for its owner", async () => {
    const { db, source } = setup();
    seedCourse(db, "u1", "c1");
    seedItem(db, "u1", "c1", "i1", 0, "Premier");
    seedExercise(db, "u1", "i1", "e1", { type: "true_false", statement: "Vrai.", answer: true });

    expect(await source.findExercise("u1", "e1")).toMatchObject({ id: "e1", type: "true_false" });
    expect(await source.findExercise("u2", "e1")).toBeNull();
  });
});
