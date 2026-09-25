import { enqueueJob, type JobQueue } from "../../jobs/index.js";
import { err, ok, type Result } from "../../shared/index.js";
import type { CourseRepository } from "../domain/ports.js";
import type { NotFound } from "./errors.js";
import { EXTRACT_COURSE_JOB, latestExtractionJobStatus, type ExtractCoursePayload } from "./latest-job.js";

export interface StartExtractionDeps {
  repo: CourseRepository;
  jobQueue: JobQueue;
}

export async function startExtraction(deps: StartExtractionDeps, userId: string, courseId: string, now: Date): Promise<Result<void, NotFound | "no-pages" | "not-pending">> {
  const course = await deps.repo.findCourse(userId, courseId);
  if (!course) return err("not-found");
  if (course.pageCount === 0) return err("no-pages");
  if (course.extractionStatus !== "pending") return err("not-pending");

  // A double tap on "C'est tout !" must not pay for two extractions.
  const latest = await latestExtractionJobStatus(deps.jobQueue, userId, courseId);
  if (latest === "pending" || latest === "running") return ok(undefined);

  const payload: ExtractCoursePayload = { courseId };
  await enqueueJob(deps, userId, EXTRACT_COURSE_JOB, payload, now);
  return ok(undefined);
}
