import { enqueueJob, type JobQueue } from "../../jobs/index.js";
import { err, ok, type Result } from "../../shared/index.js";
import type { CourseRepository } from "../domain/ports.js";
import type { NotFound } from "./errors.js";
import { EXTRACT_COURSE_JOB, latestExtractionJobStatus, type ExtractCoursePayload } from "./latest-job.js";

export interface StartExtractionDeps {
  repo: CourseRepository;
  jobQueue: JobQueue;
}

// "Sans effet si la lecture est déjà lancée" (docs/modules/ingestion.md):
// a double tap on "C'est tout !", or a screen coming back to a course whose
// reading is over, gets the same success and never pays for a second
// extraction. Only a request that makes no sense is refused.
export async function startExtraction(deps: StartExtractionDeps, userId: string, courseId: string, now: Date): Promise<Result<void, NotFound | "no-pages" | "already-confirmed">> {
  const course = await deps.repo.findCourse(userId, courseId);
  if (!course) return err("not-found");
  if (course.confirmed) return err("already-confirmed");
  if (course.pageCount === 0) return err("no-pages");
  if (course.extractionStatus !== "pending") return ok(undefined);

  // Stored pending with a job means launched: waiting, or already failed
  // (a failed reading is relaunched by retryExtraction, never from here).
  if ((await latestExtractionJobStatus(deps.jobQueue, userId, courseId)) !== null) return ok(undefined);

  const payload: ExtractCoursePayload = { courseId };
  await enqueueJob(deps, userId, EXTRACT_COURSE_JOB, payload, now);
  return ok(undefined);
}
