import { enqueueJob } from "../../jobs/index.js";
import { err, ok, type Result } from "../../shared/index.js";
import type { NotFound } from "./errors.js";
import { getCourse, type GetCourseDeps } from "./get-course.js";
import { EXTRACT_COURSE_JOB, type ExtractCoursePayload } from "./latest-job.js";

// Only after a technical failure (the jobs kernel gave up). An illegible
// photo or one with no lesson is retaken by the child, never retried.
export async function retryExtraction(deps: GetCourseDeps, userId: string, courseId: string, now: Date): Promise<Result<void, NotFound | "not-failed">> {
  const course = await getCourse(deps, userId, courseId);
  if (!course.ok) return course;
  if (course.value.extractionStatus !== "failed") return err("not-failed");

  await deps.repo.setExtractionStatus(userId, courseId, "pending");
  const payload: ExtractCoursePayload = { courseId };
  await enqueueJob(deps, userId, EXTRACT_COURSE_JOB, payload, now);
  return ok(undefined);
}
