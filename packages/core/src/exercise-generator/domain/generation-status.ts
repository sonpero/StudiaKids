import type { JobStatus } from "../../jobs/index.js";
import type { SplitOutcome } from "./items.js";

export type GenerationStatus = "not_started" | "splitting" | "insufficient_coverage" | "generating" | "ready" | "failed";
export type GenerationProgress = { status: GenerationStatus; done: number; total: number; failed: number };

// Only the split outcome is stored; the rest is derived from the jobs,
// like `failed` at M2 (docs/modules/exercise-generator.md). Progress is
// counted in game types: one generate-exercises job per type.
export function generationStatus(outcome: SplitOutcome | null, splitJob: JobStatus | null, typeJobs: JobStatus[]): GenerationProgress {
  const done = typeJobs.filter((job) => job === "done").length;
  const failed = typeJobs.filter((job) => job === "failed").length;
  const total = typeJobs.length;
  if (outcome === "insufficient_coverage") return { status: "insufficient_coverage", done: 0, total: 0, failed: 0 };
  if (outcome === "items_ready") {
    if (total === 0 || done + failed < total) return { status: "generating", done, total, failed };
    return { status: failed === total ? "failed" : "ready", done, total, failed };
  }
  if (splitJob === null) return { status: "not_started", done: 0, total: 0, failed: 0 };
  if (splitJob === "pending" || splitJob === "running") return { status: "splitting", done: 0, total: 0, failed: 0 };
  return { status: "failed", done: 0, total: 0, failed: 0 };
}
