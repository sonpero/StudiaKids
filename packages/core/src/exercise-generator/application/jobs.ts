import { z } from "zod";
import type { JobQueue, JobStatus } from "../../jobs/index.js";
import { GAME_TYPES, type GameType } from "../domain/game-types.js";

export const SPLIT_ITEMS_JOB = "split-items";
export const GENERATE_EXERCISES_JOB = "generate-exercises";

export const splitItemsPayloadSchema = z.object({ courseId: z.string() });
export type SplitItemsPayload = z.infer<typeof splitItemsPayloadSchema>;

// itemIds: a regeneration of some items only (regenerateItem); never
// counted in the course's progress.
export const generateExercisesPayloadSchema = z.object({ courseId: z.string(), type: z.enum(GAME_TYPES), itemIds: z.array(z.string()).optional() });
export type GenerateExercisesPayload = z.infer<typeof generateExercisesPayloadSchema>;

const payloadOf = (payload: unknown): Record<string, unknown> => (payload !== null && typeof payload === "object" ? (payload as Record<string, unknown>) : {});

// listJobs is newest first: the first match is the latest.
export async function latestSplitJob(jobQueue: JobQueue, userId: string, courseId: string): Promise<JobStatus | null> {
  const jobs = await jobQueue.listJobs(userId, SPLIT_ITEMS_JOB);
  return jobs.find((job) => payloadOf(job.payload).courseId === courseId)?.status ?? null;
}

// The latest whole-course job of each type (regenerations aside).
export async function latestTypeJobs(jobQueue: JobQueue, userId: string, courseId: string): Promise<Map<GameType, JobStatus>> {
  const latest = new Map<GameType, JobStatus>();
  for (const job of await jobQueue.listJobs(userId, GENERATE_EXERCISES_JOB)) {
    const payload = payloadOf(job.payload);
    if (payload.courseId !== courseId || payload.itemIds !== undefined) continue;
    const type = payload.type as GameType;
    if (!latest.has(type)) latest.set(type, job.status);
  }
  return latest;
}
