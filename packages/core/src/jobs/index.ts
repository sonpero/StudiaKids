export type { JobStatus, Job, JobContext, JobError } from "./domain/types.js";
export type { JobHandler, JobQueue, FailOptions } from "./domain/ports.js";

export { enqueueJob, type EnqueueJobDeps } from "./application/enqueue-job.js";
export { recoverStaleJobs, type RecoverStaleJobsDeps } from "./application/recover-stale-jobs.js";
export { runWorkerTick, type WorkerTickDeps } from "./application/run-worker-tick.js";

export { SqliteJobQueue, type JobsDb } from "./infra/sqlite-job-queue.js";
export { runWorkerLoop, type WorkerLoopDeps, type WorkerLoopSignal } from "./infra/worker-loop.js";
// Exported alongside the other modules' tables, same as auth/index.ts's
// accountsTable export (drizzle-kit itself reads infra/schema.ts by glob).
export { jobsTable } from "./infra/schema.js";
