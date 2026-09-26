// docs/modules/progress.md (rewritten at M5's opening): stars, streak and
// bonus derived from the attempts alone — nothing stored, no clock, no
// randomness; the time zone is the only outside parameter.

// One row per unit, as game-engine wrote it.
export type AttemptEvent = { exerciseId: string; attemptedAt: string; correct: boolean; starEligible: boolean };

export type Celebration = "streak-bonus" | "comeback";

export type SubmissionStars = {
  exerciseId: string;
  at: string;
  correct: boolean;
  eligible: boolean;
  stars: 0 | 1;
  bonus: 0 | 1;
  celebrate: Celebration | null;
};

export type Progress = { total: number; currentStreak: number; bestStreak: number; submissions: SubmissionStars[] };

// Fixed by this spec (Alexandre's « 3 » held only if the spec were silent).
export const STREAK_BONUS_THRESHOLD = 5;
export const PROGRESS_TIME_ZONE = "Europe/Paris";

// "YYYY-MM-DD" of an instant in a time zone: a Paris day, not a UTC one.
export function calendarDay(instant: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(instant));
}

type Submission = { exerciseId: string; at: string; correct: boolean; eligible: boolean };

// The units of one answer share its exercise and its instant; in the
// order they happened, whatever the order they are given in.
function submissionsOf(events: AttemptEvent[]): Submission[] {
  const byAnswer = new Map<string, Submission>();
  for (const event of events) {
    const key = `${event.attemptedAt}\u0000${event.exerciseId}`;
    const known = byAnswer.get(key);
    byAnswer.set(key, {
      exerciseId: event.exerciseId,
      at: event.attemptedAt,
      correct: (known?.correct ?? true) && event.correct,
      eligible: (known?.eligible ?? true) && event.starEligible,
    });
  }
  return [...byAnswer.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([, submission]) => submission);
}

export function deriveProgress(events: AttemptEvent[], timeZone: string): Progress {
  const rewardedOn = new Set<string>();
  const succeeded = new Set<string>();
  const missed = new Set<string>();
  let streak = 0;
  let bestStreak = 0;
  let total = 0;
  const submissions: SubmissionStars[] = [];

  for (const submission of submissionsOf(events)) {
    const base = { exerciseId: submission.exerciseId, at: submission.at, correct: submission.correct, eligible: submission.eligible };
    // A helped answer (after a reread) is outside the stars: nothing
    // earned, the streak neither extended nor broken.
    if (!submission.eligible) {
      submissions.push({ ...base, stars: 0, bonus: 0, celebrate: null });
      continue;
    }
    // A wrong answer resets the streak and never takes a star back.
    if (!submission.correct) {
      streak = 0;
      missed.add(submission.exerciseId);
      submissions.push({ ...base, stars: 0, bonus: 0, celebrate: null });
      continue;
    }
    const dayKey = `${submission.exerciseId}\u0000${calendarDay(submission.at, timeZone)}`;
    const stars = rewardedOn.has(dayKey) ? 0 : 1;
    rewardedOn.add(dayKey);
    streak += 1;
    bestStreak = Math.max(bestStreak, streak);
    const bonus = streak % STREAK_BONUS_THRESHOLD === 0 ? 1 : 0;
    const comeback = !succeeded.has(submission.exerciseId) && missed.has(submission.exerciseId);
    succeeded.add(submission.exerciseId);
    total += stars + bonus;
    submissions.push({ ...base, stars, bonus, celebrate: bonus === 1 ? "streak-bonus" : comeback ? "comeback" : null });
  }

  return { total, currentStreak: streak, bestStreak, submissions };
}

// The session summary: only what was won — stars and right answers
// (helped ones included) since an instant; never the wrong ones.
export function summarizeSince(progress: Progress, since: string): { starsSince: number; successesSince: number } {
  const recent = progress.submissions.filter((submission) => submission.at >= since);
  return {
    starsSince: recent.reduce((sum, submission) => sum + submission.stars + submission.bonus, 0),
    successesSince: recent.filter((submission) => submission.correct).length,
  };
}
