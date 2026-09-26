import { enqueueJob, type JobQueue } from "../../jobs/index.js";
import { err, ok, type Result } from "../../shared/index.js";
import type { GenerationProgress } from "../domain/generation-status.js";
import type { CourseTextSource, ItemRepository } from "../domain/ports.js";
import { getGenerationStatus } from "./get-generation-status.js";
import { SPLIT_ITEMS_JOB, type SplitItemsPayload } from "./jobs.js";

export interface StartGenerationDeps {
  courses: CourseTextSource;
  repo: ItemRepository;
  jobQueue: JobQueue;
}

// « Créer mes jeux »: never automatic. Only from not_started or failed;
// anything else answers the current status unchanged (a second tap, a
// course already generating or ready, or one too short to generate).
export async function startGeneration(deps: StartGenerationDeps, userId: string, courseId: string, now: Date): Promise<Result<GenerationProgress & { itemCount: number }, "not-found" | "not-ready">> {
  const text = await deps.courses.read(userId, courseId);
  if (!text.ok) return err(text.error);
  const current = await getGenerationStatus(deps, userId, courseId);
  if (current.status !== "not_started" && current.status !== "failed") return ok(current);
  const payload: SplitItemsPayload = { courseId };
  await enqueueJob(deps, userId, SPLIT_ITEMS_JOB, payload, now);
  return ok(await getGenerationStatus(deps, userId, courseId));
}
