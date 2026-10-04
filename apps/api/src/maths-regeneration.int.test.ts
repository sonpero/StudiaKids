import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { ok, type ExerciseGenerator, type GameType } from "@studiakids/core";
import { sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase, type Db } from "./db/connection.js";
import { runMigrations } from "./db/migrate.js";
import { regenerateMathsCourses } from "./maths-regeneration.js";

// pnpm exercises:regenerate-maths <username>: the maths courses generated
// before the per-subject rules get today's games, and no star already
// won is ever lost (docs/modules/exercise-generator.md).
const yesterday = "2026-10-03T16:00:00.000Z";
const now = new Date("2026-10-04T10:00:00.000Z");
const MATHS = "# La table de 7\n7 × 2 = 14\n7 × 3 = 21\nLe résultat d'une multiplication s'appelle le produit.";

// What the model would answer under the v5 prompts, per type.
function generator(): ExerciseGenerator & { asked: { type: GameType; markdown: string }[] } {
  const answers: Partial<Record<GameType, unknown[]>> = {
    mental_math: [{ item: 0, question: "7 × 3", answer: 21 }],
    cloze: [{ item: 0, text: "7 × 2 = {{0}}", blanks: ["14"] }],
    mcq: [{ item: 0, question: "Combien font 7 × 2 ?", options: ["12", "14", "16", "21"], answer: "14" }],
  };
  const asked: { type: GameType; markdown: string }[] = [];
  return {
    asked,
    generate: (input) => {
      asked.push({ type: input.type, markdown: input.courseMarkdown });
      return Promise.resolve(ok(answers[input.type] ?? []));
    },
  };
}

describe("regenerateMathsCourses", () => {
  let volume: string;
  let db: Db;

  function account(id: string, username: string) {
    db.run(sql`INSERT INTO accounts (id, username, password_hash, session_version, first_name, grade, created_at) VALUES (${id}, ${username}, 'x', 1, 'Léa', 'CE2', ${yesterday})`);
  }

  function course(userId: string, courseId: string, subject: string, markdown: string) {
    const color = subject === "maths" ? "matiere-maths" : "matiere-francais";
    db.run(sql`INSERT INTO courses (id, user_id, title, subject, grade, color, extraction_status, confirmed, created_at, last_accessed_at)
               VALUES (${courseId}, ${userId}, ${markdown.split("\n")[0]!.slice(2)}, ${subject}, 'CE2', ${color}, 'ready', 1, ${yesterday}, ${yesterday})`);
    db.run(sql`INSERT INTO extractions (course_id, markdown, extracted_at) VALUES (${courseId}, ${markdown}, ${yesterday})`);
    db.run(sql`INSERT INTO course_generations (course_id, user_id, split_outcome, item_count, updated_at) VALUES (${courseId}, ${userId}, 'items_ready', 6, ${yesterday})`);
  }

  function item(userId: string, courseId: string, itemId: string, types: GameType[], position: number) {
    db.run(sql`INSERT INTO items (id, course_id, user_id, title, body, game_types_json, position, created_at) VALUES (${itemId}, ${courseId}, ${userId}, ${`Item ${itemId}`}, '7 × 2 = 14', ${JSON.stringify(types)}, ${position}, ${yesterday})`);
  }

  function exercise(userId: string, itemId: string, id: string, content: Record<string, unknown> & { type: GameType }) {
    db.run(sql`INSERT INTO exercises (id, item_id, user_id, type, content_json, created_at) VALUES (${id}, ${itemId}, ${userId}, ${content.type}, ${JSON.stringify(content)}, ${yesterday})`);
  }

  function played(userId: string, exerciseId: string, type: GameType, correct: boolean) {
    db.run(sql`INSERT INTO attempts (id, user_id, exercise_id, type, unit_id, correct, star_eligible, attempted_at) VALUES (${`a-${exerciseId}`}, ${userId}, ${exerciseId}, ${type}, '0', ${correct ? 1 : 0}, 1, ${yesterday})`);
  }

  const visible = (courseId: string) =>
    db.all<{ id: string; type: string; content_json: string }>(
      sql`SELECT e.id, e.type, e.content_json FROM exercises e JOIN items i ON i.id = e.item_id WHERE i.course_id = ${courseId} AND e.retired = 0 ORDER BY e.type`,
    );
  const attemptCount = () => db.get<{ n: number }>(sql`SELECT count(*) AS n FROM attempts`).n;

  beforeEach(() => {
    volume = mkdtempSync(path.join(tmpdir(), "studiakids-maths-regeneration-"));
    db = openDatabase(path.join(volume, "test.db"));
    runMigrations(db);
    account("u1", "lea");
    account("u2", "tom");
    // Léa's maths course, generated before the rules: a delayed copy and a
    // multiple choice she won stars on, a calculation she missed, a cloze
    // whose blank is a word.
    course("u1", "maths", "maths", MATHS);
    item("u1", "maths", "i0", ["delayed_copy", "mental_math"], 0);
    item("u1", "maths", "i1", ["cloze"], 1);
    item("u1", "maths", "i2", ["mcq"], 2);
    exercise("u1", "i0", "e-copy", { type: "delayed_copy", wordOrPhrase: "produit" });
    exercise("u1", "i0", "e-mental", { type: "mental_math", question: "7 × 2", answer: 14 });
    exercise("u1", "i1", "e-word", { type: "cloze", text: "Le résultat s'appelle le {{0}}.", blanks: ["produit"] });
    exercise("u1", "i2", "e-mcq", { type: "mcq", question: "Comment s'appelle le résultat ?", options: ["la somme", "le produit", "la différence", "le quotient"], answer: "le produit" });
    played("u1", "e-copy", "delayed_copy", true);
    played("u1", "e-mcq", "mcq", true);
    played("u1", "e-mental", "mental_math", false);
    // Her French course and Tom's maths course are not touched.
    course("u1", "french", "french", "# Le verbe\nLéa chante.");
    item("u1", "french", "f0", ["delayed_copy"], 0);
    exercise("u1", "f0", "f-copy", { type: "delayed_copy", wordOrPhrase: "chante" });
    course("u2", "tom-maths", "maths", MATHS);
    item("u2", "tom-maths", "t0", ["delayed_copy"], 0);
    exercise("u2", "t0", "t-copy", { type: "delayed_copy", wordOrPhrase: "produit" });
  });
  afterEach(() => rmSync(volume, { recursive: true, force: true }));

  it("regenerates the account's maths courses under the rules, and no star is lost", async () => {
    const model = generator();

    const report = await regenerateMathsCourses({ db, generator: model }, "lea", { dryRun: false }, now);

    expect(report).toEqual(ok(expect.objectContaining({ starsBefore: 2, starsAfter: 2, courses: [expect.objectContaining({ title: "La table de 7", failed: [] })] })));
    // Never a delayed copy asked; only the maths course's text sent.
    expect(model.asked.map((a) => a.type).sort()).toEqual(["cloze", "mcq", "mental_math"]);
    expect(model.asked.every((a) => a.markdown === MATHS)).toBe(true);
    const games = visible("maths");
    expect(games.map((g) => g.type)).toEqual(["cloze", "mcq", "mental_math"]);
    // The word cloze, never played, is replaced by a number cloze.
    expect(JSON.parse(games[0]!.content_json)).toEqual({ type: "cloze", text: "7 × 2 = {{0}}", blanks: ["14"] });
    // Played ones stay as they were, and the delayed copy is retired, kept.
    expect(games.slice(1).map((g) => g.id)).toEqual(["e-mcq", "e-mental"]);
    expect(db.get<{ retired: number }>(sql`SELECT retired FROM exercises WHERE id = 'e-copy'`).retired).toBe(1);
    expect(attemptCount()).toBe(3);
    expect(visible("french").map((g) => g.id)).toEqual(["f-copy"]);
    expect(visible("tom-maths").map((g) => g.id)).toEqual(["t-copy"]);
  });

  it("--dry-run tells what would be regenerated, without a model call nor any change", async () => {
    const model = generator();
    const before = visible("maths");

    const report = await regenerateMathsCourses({ db, generator: model }, "lea", { dryRun: true }, now);

    expect(report).toEqual(ok(expect.objectContaining({ dryRun: true, starsBefore: 2, starsAfter: 2, courses: [{ title: "La table de 7", types: ["delayed_copy", "mental_math", "cloze", "mcq"], failed: [] }] })));
    expect(model.asked).toEqual([]);
    expect(visible("maths")).toEqual(before);
  });

  it("an unknown account is refused", async () => {
    expect(await regenerateMathsCourses({ db, generator: generator() }, "nobody", { dryRun: false }, now)).toEqual({ ok: false, error: "not-found" });
  });
});
