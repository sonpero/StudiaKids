import type { Grade } from "../../auth/index.js";
import { err, ok, type Result } from "../../shared/index.js";
import type { CourseRepository } from "../domain/ports.js";
import type { NotFound } from "./errors.js";

export interface GetCourseTextDeps {
  repo: CourseRepository;
}

export type CourseText = { markdown: string; grade: Grade };

// The text of a course the child confirmed, for the reader and the
// generator (M3): only a confirmed, ready course has one to give. Never its
// photos: they are gone once it is confirmed (docs/securite.md).
export async function getCourseText(deps: GetCourseTextDeps, userId: string, courseId: string): Promise<Result<CourseText, NotFound | "not-ready">> {
  const course = await deps.repo.findCourse(userId, courseId);
  if (!course) return err("not-found");
  if (!course.confirmed || course.extractionStatus !== "ready") return err("not-ready");
  const extraction = await deps.repo.getExtraction(userId, courseId);
  if (!extraction) return err("not-ready");
  return ok({ markdown: extraction.markdown, grade: course.grade });
}
