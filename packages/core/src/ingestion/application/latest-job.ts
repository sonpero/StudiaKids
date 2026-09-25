import type { JobQueue, JobStatus } from "../../jobs/index.js";

export const EXTRACT_COURSE_JOB = "extract-course";

export type ExtractCoursePayload = { courseId: string };

function isForCourse(payload: unknown, courseId: string): boolean {
  return typeof payload === "object" && payload !== null && (payload as { courseId?: unknown }).courseId === courseId;
}

// listJobs is newest first, so the first match is the course's latest job.
export async function latestExtractionJobStatus(jobQueue: JobQueue, userId: string, courseId: string): Promise<JobStatus | null> {
  const jobs = await jobQueue.listJobs(userId, EXTRACT_COURSE_JOB);
  return jobs.find((job) => isForCourse(job.payload, courseId))?.status ?? null;
}
