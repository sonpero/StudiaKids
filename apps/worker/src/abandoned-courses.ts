import { LocalFileStore, purgeAbandonedCourse, SqliteAccountRepository, SqliteCourseRepository } from "@studiakids/core";
import type { Db } from "./db/connection.js";

// docs/securite.md (2026-10-04): every account's unconfirmed course nobody
// came back to, photos included. Returns how many were purged.
export async function purgeAbandonedCourses(deps: { db: Db; volumeRoot: string }, now: Date): Promise<number> {
  const courses = { repo: new SqliteCourseRepository(deps.db), fileStore: new LocalFileStore(deps.volumeRoot) };
  let purged = 0;
  for (const userId of await new SqliteAccountRepository(deps.db).listAccountIds()) if (await purgeAbandonedCourse(courses, userId, now)) purged++;
  return purged;
}
