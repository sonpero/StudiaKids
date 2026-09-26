import type { Grade } from "../../auth/index.js";
import type { ExerciseContent } from "../../exercise-generator/index.js";
import type { ComparisonResult, GivenAnswer } from "./compare.js";

export type NewAttempt = { unitId: string; correct: boolean; starEligible: boolean };

// docs/modules/game-engine.md: a success event is a correct attempt that
// can earn a star. A reread keeps `correct` faithful but never earns one:
// it never writes a success event (M4 criterion, « à valider »).
export const isSuccess = (attempt: { correct: boolean; starEligible: boolean }) => attempt.correct && attempt.starEligible;

export function attemptsFor(result: ComparisonResult, options: { reread: boolean }): NewAttempt[] {
  return result.units.map((unit) => ({ unitId: unit.id, correct: unit.correct, starEligible: !options.reread }));
}

const DISPLAY_DURATION_MS: Record<Grade, number> = { CP: 5000, CE1: 4000, CE2: 3500, CM1: 3000, CM2: 2500, "6e": 2000 };

// The spec's starting values, to adjust after real use.
export const displayDurationMs = (grade: Grade) => DISPLAY_DURATION_MS[grade];

export type PlayableExercise = { id: string; itemTitle: string } & (
  | { type: "delayed_copy"; wordOrPhrase: string; displayDurationMs: number }
  | { type: "mcq"; question: string; options: string[] }
  | { type: "matching"; lefts: string[]; rights: string[] }
  | { type: "reordering"; elements: string[] }
  | { type: "cloze"; text: string; blankCount: number }
  | { type: "true_false"; statement: string }
  | { type: "mental_math"; question: string }
);

// Deterministic from the exercise's id: the same screen every time it is
// opened, and nothing to store.
function random(seed: string): () => number {
  let state = 2166136261;
  for (const char of seed) state = Math.imul(state ^ char.charCodeAt(0), 16777619) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Fisher–Yates: any order, the right option first included.
function shuffled<T>(items: readonly T[], next: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

// Sattolo: a random cycle, so no element stays in its place — the right
// order (or a right facing its own left) is never handed over.
function displaced<T>(items: readonly T[], next: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(next() * i);
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

// What the screen shows: never the answer (docs/modules/game-engine.md,
// "Vue jouable"); the correction is the server's alone.
export function playableView(exercise: { id: string; itemTitle: string; content: ExerciseContent }, grade: Grade): PlayableExercise {
  const { id, itemTitle, content } = exercise;
  switch (content.type) {
    case "delayed_copy":
      return { id, itemTitle, type: "delayed_copy", wordOrPhrase: content.wordOrPhrase, displayDurationMs: displayDurationMs(grade) };
    case "mcq":
      return { id, itemTitle, type: "mcq", question: content.question, options: shuffled(content.options, random(id)) };
    case "matching": {
      return { id, itemTitle, type: "matching", lefts: content.pairs.map((pair) => pair.left), rights: displaced(content.pairs.map((pair) => pair.right), random(id)) };
    }
    case "reordering":
      return { id, itemTitle, type: "reordering", elements: displaced(content.elements, random(id)) };
    case "cloze":
      return { id, itemTitle, type: "cloze", text: content.text, blankCount: content.blanks.length };
    case "true_false":
      return { id, itemTitle, type: "true_false", statement: content.statement };
    case "mental_math":
      return { id, itemTitle, type: "mental_math", question: content.question };
  }
}

export type AttemptRecord = { exerciseId: string; attemptedAt: string; correct: boolean; starEligible: boolean };

// docs/modules/game-engine.md, `nextExercise`: the first exercise, in the
// course's order, with no successful submission (every unit of one
// submission a success event); back to the first once all are.
export function nextExercise(exerciseIds: string[], attempts: AttemptRecord[]): string | null {
  const submissions = new Map<string, boolean>();
  for (const attempt of attempts) {
    const key = `${attempt.exerciseId}\u0000${attempt.attemptedAt}`;
    submissions.set(key, (submissions.get(key) ?? true) && isSuccess(attempt));
  }
  const succeeded = new Set([...submissions].filter(([, success]) => success).map(([key]) => key.split("\u0000")[0]));
  return exerciseIds.find((id) => !succeeded.has(id)) ?? exerciseIds[0] ?? null;
}

// After a wrong answer, the right one in the shape of a given answer
// (M4 closing decision): the screen shows it like one, briefly.
export function correctionOf(content: ExerciseContent): GivenAnswer[ExerciseContent["type"]] {
  switch (content.type) {
    case "mcq":
      return { chosenOption: content.answer };
    case "true_false":
      return { value: content.answer };
    case "mental_math":
      // Written as a French pupil writes it: a decimal comma.
      return { value: String(content.answer).replace(".", ",") };
    case "delayed_copy":
      return { text: content.wordOrPhrase };
    case "cloze":
      return { values: [...content.blanks] };
    case "matching":
      return { pairs: content.pairs.map((pair) => ({ ...pair })) };
    case "reordering":
      return { order: [...content.elements] };
  }
}
