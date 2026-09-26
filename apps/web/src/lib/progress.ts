import { progressSchema, type ProgressDto } from "@studiakids/contracts";
import { HttpError } from "./http-error.js";

// docs/modules/progress.md: the account's counters; with `since`, the
// session's stars and right answers.
export async function getProgress(since?: string): Promise<ProgressDto> {
  const res = await fetch(since === undefined ? "/api/progress" : `/api/progress?since=${encodeURIComponent(since)}`);
  if (!res.ok) throw new HttpError(res.status, "GET /api/progress");
  return progressSchema.parse(await res.json());
}

export const starsLabel = (total: number) => `${String(total)} étoile${total > 1 ? "s" : ""}`;
