import { enqueueJob, type JobQueue } from "../../jobs/index.js";
import { err, ok, type Result } from "../../shared/index.js";
import type { ItemRepository } from "../domain/ports.js";
import { GENERATE_EXERCISES_JOB, type GenerateExercisesPayload } from "./jobs.js";

export interface RegenerateItemDeps {
  repo: ItemRepository;
  jobQueue: JobQueue;
}

// One generation job per type of the item, limited to it.
export async function regenerateItem(deps: RegenerateItemDeps, userId: string, itemId: string, now: Date): Promise<Result<void, "not-found">> {
  const item = await deps.repo.findItem(userId, itemId);
  if (!item) return err("not-found");
  for (const type of item.applicableGameTypes) {
    const payload: GenerateExercisesPayload = { courseId: item.courseId, type, itemIds: [itemId] };
    await enqueueJob(deps, userId, GENERATE_EXERCISES_JOB, payload, now);
  }
  return ok(undefined);
}
