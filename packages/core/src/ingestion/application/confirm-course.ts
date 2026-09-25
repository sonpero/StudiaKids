import { err, ok, type Result } from "../../shared/index.js";
import type { CourseRepository } from "../domain/ports.js";
import type { NotFound } from "./errors.js";

export interface ConfirmCourseDeps {
  repo: CourseRepository;
}

// "Oui, c'est ça !": only a ready course can be confirmed, so nothing is
// ever shown as settled before the job actually finished (docs/ui.md).
export async function confirmCourse(deps: ConfirmCourseDeps, userId: string, courseId: string, _now: Date): Promise<Result<void, NotFound | "not-ready">> {
  const course = await deps.repo.findCourse(userId, courseId);
  if (!course) return err("not-found");
  if (course.extractionStatus !== "ready") return err("not-ready");
  await deps.repo.confirmCourse(userId, courseId);
  return ok(undefined);
}
