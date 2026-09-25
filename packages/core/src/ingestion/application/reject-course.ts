import { err, type Result } from "../../shared/index.js";
import type { NotFound } from "./errors.js";
import { deleteCourse, type DeleteCourseDeps } from "./delete-course.js";

// "Je reprends la photo": nothing of a never-confirmed course is kept.
// A confirmed course is deleted through deleteCourse, never through here.
export async function rejectCourse(deps: DeleteCourseDeps, userId: string, courseId: string, _now: Date): Promise<Result<void, NotFound | "already-confirmed">> {
  const course = await deps.repo.findCourse(userId, courseId);
  if (!course) return err("not-found");
  if (course.confirmed) return err("already-confirmed");
  return deleteCourse(deps, userId, courseId);
}
