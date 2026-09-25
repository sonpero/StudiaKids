import { err, ok, type Result } from "../../shared/index.js";
import type { CourseRepository } from "../domain/ports.js";
import type { NotFound } from "./errors.js";

export interface RecordAccessDeps {
  repo: CourseRepository;
}

// Called when the reader or games screen actually shows the course, never
// from the home list itself (docs/modules/ingestion.md).
export async function recordAccess(deps: RecordAccessDeps, userId: string, courseId: string, now: Date): Promise<Result<void, NotFound>> {
  const course = await deps.repo.findCourse(userId, courseId);
  if (!course) return err("not-found");
  await deps.repo.touchCourse(userId, courseId, now);
  return ok(undefined);
}
