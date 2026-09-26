import { z } from "zod";
import type { JobHandler } from "../../jobs/index.js";
import { handleExtractionJob, type HandleExtractionJobDeps } from "./handle-extraction-job.js";
import { EXTRACT_COURSE_JOB, type ExtractCoursePayload } from "./latest-job.js";

const extractCoursePayloadSchema = z.object({ courseId: z.string() });

// What apps/worker registers at startup (docs/modules/jobs.md): the jobs
// kernel validates the payload before the handler ever sees it.
export function extractCourseJobHandler(deps: HandleExtractionJobDeps): JobHandler<ExtractCoursePayload> {
  return {
    type: EXTRACT_COURSE_JOB,
    payloadSchema: extractCoursePayloadSchema,
    handle: (payload, ctx) => handleExtractionJob(deps, payload, ctx),
  };
}
