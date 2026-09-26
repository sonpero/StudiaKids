import { enqueueJob, type JobContext, type JobError, type JobQueue } from "../../jobs/index.js";
import { err, ok, type IdGenerator, type Result } from "../../shared/index.js";
import type { GameType } from "../domain/game-types.js";
import { coverageOutcome, validItems } from "../domain/items.js";
import type { CourseTextSource, Item, ItemRepository, ItemSplitter } from "../domain/ports.js";
import { GENERATE_EXERCISES_JOB, latestTypeJobs, type GenerateExercisesPayload, type SplitItemsPayload } from "./jobs.js";

export { SPLIT_ITEMS_JOB } from "./jobs.js";

export interface HandleSplittingJobDeps {
  courses: CourseTextSource;
  splitter: ItemSplitter;
  repo: ItemRepository;
  jobQueue: JobQueue;
  idGenerator: IdGenerator;
}

// One job per game type present, in the order the items first carry them;
// a type that already has a whole-course job is never enqueued twice.
async function enqueueMissingTypeJobs(deps: HandleSplittingJobDeps, userId: string, courseId: string, items: Item[], now: Date): Promise<void> {
  const existing = await latestTypeJobs(deps.jobQueue, userId, courseId);
  const types: GameType[] = [];
  for (const item of items) for (const type of item.applicableGameTypes) if (!types.includes(type)) types.push(type);
  for (const type of types) {
    if (existing.has(type)) continue;
    const payload: GenerateExercisesPayload = { courseId, type };
    await enqueueJob(deps, userId, GENERATE_EXERCISES_JOB, payload, now);
  }
}

// Idempotent: a course already split is never split (nor paid for) again;
// insufficient coverage is a business result, the job succeeds and is
// never retried (docs/modules/exercise-generator.md).
export async function handleSplittingJob(deps: HandleSplittingJobDeps, payload: SplitItemsPayload, ctx: JobContext): Promise<Result<void, JobError>> {
  const text = await deps.courses.read(ctx.userId, payload.courseId);
  if (!text.ok) return ok(undefined);

  const done = await deps.repo.findSplitOutcome(ctx.userId, payload.courseId);
  if (done?.outcome === "insufficient_coverage") return ok(undefined);
  if (done?.outcome === "items_ready") {
    await enqueueMissingTypeJobs(deps, ctx.userId, payload.courseId, await deps.repo.listItems(ctx.userId, payload.courseId), ctx.now);
    return ok(undefined);
  }

  const proposals = await deps.splitter.split(text.value);
  if (!proposals.ok) return err(proposals.error.message);
  const valid = validItems(proposals.value);
  const outcome = coverageOutcome(valid.length);
  const createdAt = ctx.now.toISOString();
  const items: Item[] =
    outcome === "items_ready" ? valid.map((item) => ({ ...item, id: deps.idGenerator.next(), courseId: payload.courseId, userId: ctx.userId, createdAt })) : [];
  await deps.repo.saveSplit(ctx.userId, payload.courseId, { items, outcome, itemCount: valid.length }, ctx.now);
  if (outcome === "items_ready") await enqueueMissingTypeJobs(deps, ctx.userId, payload.courseId, items, ctx.now);
  return ok(undefined);
}
