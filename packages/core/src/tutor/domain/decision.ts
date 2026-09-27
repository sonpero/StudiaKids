import { calendarDay, PROGRESS_TIME_ZONE } from "../../progress/index.js";
import type { Result } from "../../shared/index.js";

export type Classification = { onTopic: boolean; sensitive: boolean; distress: boolean };
export type ClassificationError = { kind: "model-error" | "invalid-output"; message: string };

export type Decision = { kind: "answer" } | { kind: "distress" } | { kind: "refusal"; reason: "off_topic" | "sensitive" } | { kind: "unavailable" } | { kind: "daily_limit" };

// 40 questions an account and a Paris calendar day (« à valider »).
export const TUTOR_DAILY_LIMIT = 40;

// docs/modules/tutor.md and docs/securite.md (M6): what happens to a
// question, decided before any answer model is ever called. Distress first,
// always — a lexical pre-filter that saw distress, even with a failed
// classifier, even over the daily cap; a failed classifier never reaches
// the answer model; then sensitive, then off-topic, then the cap.
export function decide(input: { prefilterDistress: boolean; limitReached: boolean; classification: Result<Classification, ClassificationError> }): Decision {
  if (input.prefilterDistress) return { kind: "distress" };
  if (!input.classification.ok) return { kind: "unavailable" };
  const { onTopic, sensitive, distress } = input.classification.value;
  if (distress) return { kind: "distress" };
  if (sensitive) return { kind: "refusal", reason: "sensitive" };
  if (!onTopic) return { kind: "refusal", reason: "off_topic" };
  if (input.limitReached) return { kind: "daily_limit" };
  return { kind: "answer" };
}

// The account's questions asked on today's Paris calendar day.
export function questionsToday(askedAt: string[], now: Date): number {
  const today = calendarDay(now.toISOString(), PROGRESS_TIME_ZONE);
  return askedAt.filter((at) => calendarDay(at, PROGRESS_TIME_ZONE) === today).length;
}

export const isLimitReached = (questionsSoFarToday: number) => questionsSoFarToday >= TUTOR_DAILY_LIMIT;
