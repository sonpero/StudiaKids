import type { AttemptsQuery } from "../domain/ports.js";
import { deriveProgress, PROGRESS_TIME_ZONE, summarizeSince, type Celebration } from "../domain/progress.js";

export interface GetProgressDeps {
  attempts: AttemptsQuery;
}

export type ProgressView = {
  total: number;
  currentStreak: number;
  bestStreak: number;
  starsSince?: number;
  successesSince?: number;
  // What one answer earned (its stars and bonus) and its celebration.
  submission?: { stars: number; celebrate: Celebration | null };
};

// Derived at every read from the account's attempts, in Paris time:
// nothing stored, nothing that could drift (docs/modules/progress.md).
export async function getProgress(deps: GetProgressDeps, userId: string, options: { since?: string; submission?: { exerciseId: string; at: string } }): Promise<ProgressView> {
  const progress = deriveProgress(await deps.attempts.listByUser(userId), PROGRESS_TIME_ZONE);
  const view: ProgressView = { total: progress.total, currentStreak: progress.currentStreak, bestStreak: progress.bestStreak };
  if (options.since !== undefined) Object.assign(view, summarizeSince(progress, options.since));
  if (options.submission) {
    const { exerciseId, at } = options.submission;
    const answer = progress.submissions.find((submission) => submission.exerciseId === exerciseId && submission.at === at);
    view.submission = answer ? { stars: answer.stars + answer.bonus, celebrate: answer.celebrate } : { stars: 0, celebrate: null };
  }
  return view;
}
