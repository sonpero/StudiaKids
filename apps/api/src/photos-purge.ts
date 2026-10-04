import { LocalFileStore, removeConfirmedCoursePhotos, SqliteAccountRepository, SqliteCourseRepository } from "@studiakids/core";
import type { Db } from "./db/connection.js";

export type PhotosPurgeReport = { dryRun: boolean; courses: number; files: number; bytes: number };

// pnpm photos:purge (docs/securite.md, 2026-10-04): the photos confirmed
// courses still have — kept before the rule changed, or left by a removal
// that failed at confirmation. Every account; an unconfirmed course keeps
// its own, its extraction may still need them. CLI only.
export async function purgeConfirmedCoursePhotos(deps: { db: Db; volumeRoot: string }, options: { dryRun: boolean }): Promise<PhotosPurgeReport> {
  const repo = new SqliteCourseRepository(deps.db);
  const photos = { repo, fileStore: new LocalFileStore(deps.volumeRoot) };
  const report: PhotosPurgeReport = { dryRun: options.dryRun, courses: 0, files: 0, bytes: 0 };
  for (const userId of await new SqliteAccountRepository(deps.db).listAccountIds()) {
    for (const course of await repo.listConfirmedCourses(userId)) {
      const removed = await removeConfirmedCoursePhotos(photos, userId, course.id, options);
      if (removed.files === 0) continue;
      report.courses++;
      report.files += removed.files;
      report.bytes += removed.bytes;
    }
  }
  return report;
}
