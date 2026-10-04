import {
  err,
  getProgress,
  IngestionCourseTexts,
  listAttemptsForProgress,
  ok,
  regenerateCourse,
  SqliteAccountRepository,
  SqliteAttemptRepository,
  SqliteCourseRepository,
  SqliteItemRepository,
  uuidV7Generator,
  type ExerciseGenerator,
  type GameType,
  type Result,
} from "@studiakids/core";
import type { Db } from "./db/connection.js";

export type MathsRegenerationReport = {
  dryRun: boolean;
  courses: { title: string; types: GameType[]; failed: GameType[] }[];
  starsBefore: number;
  starsAfter: number;
};

// docs/modules/exercise-generator.md, "Régénérer un cours déjà généré":
// one account's maths courses, made before the per-subject rules, get
// today's games. No star is lost: a played exercise is never deleted (kept
// as it is, or retired when the rules forbid it). CLI only.
export async function regenerateMathsCourses(
  deps: { db: Db; generator: ExerciseGenerator },
  username: string,
  options: { dryRun: boolean },
  now: Date,
): Promise<Result<MathsRegenerationReport, "not-found">> {
  const account = await new SqliteAccountRepository(deps.db).findByUsername(username);
  if (!account) return err("not-found");
  const courseRepo = new SqliteCourseRepository(deps.db);
  const items = new SqliteItemRepository(deps.db);
  const attempts = new SqliteAttemptRepository(deps.db);
  const stars = async () => (await getProgress({ attempts: { listByUser: (userId) => listAttemptsForProgress({ attempts }, userId) } }, account.id, {})).total;
  const regeneration = { courses: new IngestionCourseTexts(courseRepo), repo: items, generator: deps.generator, idGenerator: uuidV7Generator };

  const starsBefore = await stars();
  const courses: MathsRegenerationReport["courses"] = [];
  for (const course of await courseRepo.listConfirmedCourses(account.id)) {
    if (course.subject !== "maths" || course.extractionStatus !== "ready") continue;
    if (options.dryRun) {
      const types: GameType[] = [];
      for (const item of await items.listItems(account.id, course.id)) for (const type of item.applicableGameTypes) if (!types.includes(type)) types.push(type);
      courses.push({ title: course.title, types, failed: [] });
      continue;
    }
    const result = await regenerateCourse(regeneration, account.id, course.id, now);
    if (result.ok) courses.push({ title: course.title, ...result.value });
  }
  return ok({ dryRun: options.dryRun, courses, starsBefore, starsAfter: await stars() });
}
