import type { CourseRepository, FileStore } from "../domain/ports.js";

export interface RemoveCoursePhotosDeps {
  repo: CourseRepository;
  fileStore: FileStore;
}

// Files first, then their rows: if removing the files fails, the rows
// still say where they are, for the purge to find them (docs/securite.md).
export async function removeCoursePhotos(deps: RemoveCoursePhotosDeps, userId: string, courseId: string): Promise<void> {
  await deps.fileStore.deleteCourse(userId, courseId);
  await deps.repo.deletePages(userId, courseId);
}

// The photos a confirmed course still has: kept before 2026-10-04, or left
// by a removal that failed at confirmation. An unconfirmed course keeps
// them, its extraction may still need them.
export async function removeConfirmedCoursePhotos(deps: RemoveCoursePhotosDeps, userId: string, courseId: string, options: { dryRun: boolean }): Promise<{ files: number; bytes: number }> {
  const course = await deps.repo.findCourse(userId, courseId);
  if (!course?.confirmed) return { files: 0, bytes: 0 };
  const usage = await deps.fileStore.measureCourse(userId, courseId);
  if (!options.dryRun) await removeCoursePhotos(deps, userId, courseId);
  return usage;
}
