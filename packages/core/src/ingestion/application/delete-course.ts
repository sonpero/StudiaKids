import { err, ok, type Result } from "../../shared/index.js";
import type { CourseRepository, FileStore } from "../domain/ports.js";
import type { NotFound } from "./errors.js";

export interface DeleteCourseDeps {
  repo: CourseRepository;
  fileStore: FileStore;
}

// Files first, then rows, in the same call (docs/modules/ingestion.md): if
// it breaks midway, a course without its photos is visible and can be
// deleted again, whereas photos without their course would outlive it
// silently (docs/securite.md).
export async function deleteCourse(deps: DeleteCourseDeps, userId: string, courseId: string): Promise<Result<void, NotFound>> {
  const course = await deps.repo.findCourse(userId, courseId);
  if (!course) return err("not-found");
  await deps.fileStore.deleteCourse(userId, courseId);
  await deps.repo.deleteCourse(userId, courseId);
  return ok(undefined);
}
