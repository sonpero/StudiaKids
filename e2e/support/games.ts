import path from "node:path";
import { expect, type APIRequestContext } from "@playwright/test";
import { uuidV7Generator } from "@studiakids/core";
import Database from "better-sqlite3";
import { confirmedCourse } from "./course.js";
import { E2E_DATA_DIR } from "./env.js";

// A confirmed course whose games were made by the worker from the recorded
// fixtures (« Le verbe »: six game types, no mental calculation).
export async function courseWithGames(request: APIRequestContext): Promise<string> {
  const courseId = await confirmedCourse(request, "legible");
  expect((await request.post(`/api/courses/${courseId}/generate`)).status()).toBe(202);
  await expect
    .poll(async () => ((await (await request.get(`/api/courses/${courseId}/generation-status`)).json()) as { status: string }).status, { timeout: 30_000 })
    .toBe("ready");
  return courseId;
}

function withDb<T>(use: (db: Database.Database) => T): T {
  const db = new Database(path.join(E2E_DATA_DIR, "db", "studiakids.db"));
  db.pragma("busy_timeout = 5000");
  try {
    return use(db);
  } finally {
    db.close();
  }
}

// The recorded lesson has no mental calculation: this one is written
// straight into the course, as the generation would have (test set-up,
// never a model call).
export async function courseWithMentalMath(request: APIRequestContext, username: string): Promise<string> {
  const courseId = await confirmedCourse(request, "legible");
  withDb((db) => {
    const { id: userId } = db.prepare("SELECT id FROM accounts WHERE username = ?").get(username) as { id: string };
    const itemId = uuidV7Generator.next();
    const now = new Date().toISOString();
    db.prepare("INSERT INTO items (id, course_id, user_id, title, body, game_types_json, position, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)").run(
      itemId,
      courseId,
      userId,
      "Des additions à connaître",
      "8 + 5 = 13",
      '["mental_math"]',
      now,
    );
    db.prepare("INSERT INTO exercises (id, item_id, user_id, type, content_json, created_at) VALUES (?, ?, ?, 'mental_math', ?, ?)").run(
      uuidV7Generator.next(),
      itemId,
      userId,
      JSON.stringify({ type: "mental_math", question: "8 + 5", answer: 13 }),
      now,
    );
  });
  return courseId;
}

// What was recorded for this account's attempts of a game type: never an
// answer, only the result and its star eligibility.
export function attemptsOf(username: string, type: string): { correct: number; star_eligible: number }[] {
  return withDb(
    (db) =>
      db
        .prepare("SELECT a.correct, a.star_eligible FROM attempts a JOIN accounts u ON u.id = a.user_id WHERE u.username = ? AND a.type = ? ORDER BY a.attempted_at")
        .all(username, type) as { correct: number; star_eligible: number }[],
  );
}

// A confirmed course written straight into the base with its games
// (M5 scenarios: several courses with distinct titles, known answers).
// Its last access is set in the past, so that opening it makes it the last.
export function seedCourseWithGames(username: string, title: string, games: { item: string; content: Record<string, unknown> & { type: string } }[]): string {
  return withDb((db) => {
    const { id: userId } = db.prepare("SELECT id FROM accounts WHERE username = ?").get(username) as { id: string };
    const courseId = uuidV7Generator.next();
    const long = "2026-01-01T08:00:00.000Z";
    db.prepare("INSERT INTO courses (id, user_id, title, subject, grade, color, extraction_status, confirmed, created_at, last_accessed_at) VALUES (?, ?, ?, 'french', 'CM1', 'matiere-francais', 'ready', 1, ?, ?)").run(
      courseId,
      userId,
      title,
      long,
      long,
    );
    db.prepare("INSERT INTO extractions (course_id, markdown, extracted_at) VALUES (?, ?, ?)").run(courseId, `# ${title}`, long);
    games.forEach(({ item, content }, position) => {
      const itemId = uuidV7Generator.next();
      db.prepare("INSERT INTO items (id, course_id, user_id, title, body, game_types_json, position, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(
        itemId,
        courseId,
        userId,
        item,
        item,
        JSON.stringify([content.type]),
        position,
        long,
      );
      db.prepare("INSERT INTO exercises (id, item_id, user_id, type, content_json, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(uuidV7Generator.next(), itemId, userId, content.type, JSON.stringify(content), long);
    });
    return courseId;
  });
}

// Five true-or-false games whose answer is « Vrai », then one whose answer is « Faux ».
export const TRUE_FALSE_GAMES = [
  ...["Point un", "Point deux", "Point trois", "Point quatre", "Point cinq"].map((item) => ({ item, content: { type: "true_false", statement: `${item} : c'est dans la leçon.`, answer: true } })),
  { item: "Point six", content: { type: "true_false", statement: "Point six : ce n'est pas dans la leçon.", answer: false } },
];
