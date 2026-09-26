import type { JobQueue } from "../../jobs/index.js";
import { generationStatus, type GenerationProgress } from "../domain/generation-status.js";
import type { ItemRepository } from "../domain/ports.js";
import { latestSplitJob, latestTypeJobs } from "./jobs.js";

export interface GetGenerationStatusDeps {
  repo: ItemRepository;
  jobQueue: JobQueue;
}

// Derived, never stored beyond the split outcome
// (docs/modules/exercise-generator.md).
export async function getGenerationStatus(deps: GetGenerationStatusDeps, userId: string, courseId: string): Promise<GenerationProgress & { itemCount: number }> {
  const split = await deps.repo.findSplitOutcome(userId, courseId);
  const splitJob = await latestSplitJob(deps.jobQueue, userId, courseId);
  const typeJobs = await latestTypeJobs(deps.jobQueue, userId, courseId);
  return { ...generationStatus(split?.outcome ?? null, splitJob, [...typeJobs.values()]), itemCount: split?.outcome === "items_ready" ? split.itemCount : 0 };
}
