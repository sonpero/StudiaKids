import { err, ok, type Result } from "../../shared/index.js";
import type { CourseRepository, FileStore } from "../domain/ports.js";
import type { NotFound } from "./errors.js";
import { removeCoursePhotos } from "./remove-course-photos.js";

export interface ConfirmCourseDeps {
  repo: CourseRepository;
  fileStore: FileStore;
  // A photo that could not be removed: told to the caller, which logs it.
  // Only the course id and the error, never anything of the course.
  onPhotoRemovalFailure?: (failure: { courseId: string; message: string }) => void;
}

// "Oui, c'est ça !": only a ready course can be confirmed, so nothing is
// ever shown as settled before the job actually finished (docs/ui.md).
// Its photos served only the extraction: they go now, and a failure to
// remove them never fails the confirmation (docs/securite.md).
export async function confirmCourse(deps: ConfirmCourseDeps, userId: string, courseId: string, _now: Date): Promise<Result<void, NotFound | "not-ready">> {
  const course = await deps.repo.findCourse(userId, courseId);
  if (!course) return err("not-found");
  if (course.extractionStatus !== "ready") return err("not-ready");
  await deps.repo.confirmCourse(userId, courseId);
  try {
    await removeCoursePhotos(deps, userId, courseId);
  } catch (error) {
    deps.onPhotoRemovalFailure?.({ courseId, message: error instanceof Error ? error.message : String(error) });
  }
  return ok(undefined);
}
