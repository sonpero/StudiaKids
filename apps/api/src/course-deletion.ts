import { deleteCourse, detachAttempts, LocalFileStore, SqliteAttemptRepository, SqliteCourseRepository, SqliteItemRepository, type NotFound, type Result } from "@studiakids/core";
import { sql } from "drizzle-orm";
import type { Db } from "./db/connection.js";

export interface CourseDeletionDeps {
  db: Db;
  volumeRoot: string;
}

// DELETE /api/courses/:id (decided on 2026-10-04, docs/modules/ingestion.md):
// everything of the course goes, never a star. Composes the modules through
// their index.ts, in this order:
// 1. its exercises' attempts are detached (game-engine): they outlive the
//    course with nothing but what stars and the streak need;
// 2. its jobs go, whatever their status: a running one finds no course and
//    ends as a no-op, its completion updating no row;
// 3. the course goes (ingestion): photos, then rows, the rest following by
//    ON DELETE CASCADE (text, items, exercises, conversations, messages).
// Another account's course reads as not-found before anything is touched.
export async function deleteCourseWithContent(deps: CourseDeletionDeps, userId: string, courseId: string): Promise<Result<void, NotFound>> {
  const repo = new SqliteCourseRepository(deps.db);
  if (!(await repo.findCourse(userId, courseId))) return { ok: false, error: "not-found" };

  const exerciseIds = await new SqliteItemRepository(deps.db).listCourseExerciseIds(userId, courseId);
  await detachAttempts({ attempts: new SqliteAttemptRepository(deps.db) }, userId, exerciseIds);
  // jobs is frozen (CLAUDE.md) and its queue has no deletion: its table is
  // reached through a bound query, its schema untouched.
  deps.db.run(sql`DELETE FROM jobs WHERE user_id = ${userId} AND json_extract(payload_json, '$.courseId') = ${courseId}`);
  return deleteCourse({ repo, fileStore: new LocalFileStore(deps.volumeRoot) }, userId, courseId);
}
