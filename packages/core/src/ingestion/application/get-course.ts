import type { JobQueue } from "../../jobs/index.js";
import { err, ok, type Result } from "../../shared/index.js";
import { displayStatus } from "../domain/extraction.js";
import type { CourseRepository } from "../domain/ports.js";
import type { Course, ExtractionStatus } from "../domain/types.js";
import type { NotFound } from "./errors.js";
import { latestExtractionJobStatus } from "./latest-job.js";

export type CourseView = Omit<Course, "extractionStatus"> & { extractionStatus: ExtractionStatus };

export interface GetCourseDeps {
  repo: CourseRepository;
  jobQueue: JobQueue;
}

// `failed` only exists here, at read time: the stored status never holds it.
export async function toCourseView(jobQueue: JobQueue, course: Course): Promise<CourseView> {
  const latest = await latestExtractionJobStatus(jobQueue, course.userId, course.id);
  return { ...course, extractionStatus: displayStatus(course.extractionStatus, latest) };
}

export async function getCourse(deps: GetCourseDeps, userId: string, courseId: string): Promise<Result<CourseView, NotFound>> {
  const course = await deps.repo.findCourse(userId, courseId);
  if (!course) return err("not-found");
  return ok(await toCourseView(deps.jobQueue, course));
}
