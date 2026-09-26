import type { JobHandler } from "../../jobs/index.js";
import { handleGenerationJob, type HandleGenerationJobDeps } from "./handle-generation-job.js";
import { handleSplittingJob, type HandleSplittingJobDeps } from "./handle-splitting-job.js";
import { GENERATE_EXERCISES_JOB, generateExercisesPayloadSchema, SPLIT_ITEMS_JOB, splitItemsPayloadSchema, type GenerateExercisesPayload, type SplitItemsPayload } from "./jobs.js";

// Registered by apps/worker at startup; the jobs kernel validates each
// payload before the handler sees it.
export function splitItemsJobHandler(deps: HandleSplittingJobDeps): JobHandler<SplitItemsPayload> {
  return { type: SPLIT_ITEMS_JOB, payloadSchema: splitItemsPayloadSchema, handle: (payload, ctx) => handleSplittingJob(deps, payload, ctx) };
}

export function generateExercisesJobHandler(deps: HandleGenerationJobDeps): JobHandler<GenerateExercisesPayload> {
  return { type: GENERATE_EXERCISES_JOB, payloadSchema: generateExercisesPayloadSchema, handle: (payload, ctx) => handleGenerationJob(deps, payload, ctx) };
}
