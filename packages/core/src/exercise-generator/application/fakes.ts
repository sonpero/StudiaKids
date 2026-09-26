// In-memory test doubles for exercise-generator's ports (CLAUDE.md rule 3).
import type { Job, JobQueue } from "../../jobs/index.js";
import { err, ok, type Result } from "../../shared/index.js";
import type { GameType } from "../domain/game-types.js";
import type { ItemProposal, SplitOutcome } from "../domain/items.js";
import type { CourseTextSource, Exercise, ExerciseGenerator, GenerationError, Item, ItemRepository, ItemSplitter } from "../domain/ports.js";

export function fakeItemRepository(): ItemRepository & { items: Item[]; exercises: Exercise[]; outcomes: Map<string, { outcome: SplitOutcome; itemCount: number }> } {
  const items: Item[] = [];
  const exercises: Exercise[] = [];
  const outcomes = new Map<string, { outcome: SplitOutcome; itemCount: number }>();
  const key = (userId: string, courseId: string) => `${userId}/${courseId}`;
  return {
    items,
    exercises,
    outcomes,
    findSplitOutcome: (userId, courseId) => Promise.resolve(outcomes.get(key(userId, courseId)) ?? null),
    saveSplit: (userId, courseId, { items: newItems, outcome, itemCount }) => {
      const gone = new Set(items.filter((i) => i.userId === userId && i.courseId === courseId).map((i) => i.id));
      for (let i = items.length - 1; i >= 0; i--) if (gone.has(items[i]!.id)) items.splice(i, 1);
      for (let i = exercises.length - 1; i >= 0; i--) if (gone.has(exercises[i]!.itemId)) exercises.splice(i, 1);
      items.push(...newItems.map((item) => ({ ...item })));
      outcomes.set(key(userId, courseId), { outcome, itemCount });
      return Promise.resolve();
    },
    listItems: (userId, courseId) =>
      Promise.resolve(items.filter((i) => i.userId === userId && i.courseId === courseId).sort((a, b) => a.position - b.position).map((i) => ({ ...i }))),
    findItem: (userId, itemId) => Promise.resolve(items.find((i) => i.userId === userId && i.id === itemId) ?? null),
    listExercises: (userId, itemIds, type) =>
      Promise.resolve(exercises.filter((e) => e.userId === userId && itemIds.includes(e.itemId) && (type === undefined || e.type === type)).map((e) => ({ ...e }))),
    applyExercises: (userId, change) => {
      for (let i = exercises.length - 1; i >= 0; i--) if (exercises[i]!.userId === userId && change.remove.includes(exercises[i]!.id)) exercises.splice(i, 1);
      for (const exercise of change.insert) {
        if (exercises.some((e) => e.itemId === exercise.itemId && e.type === exercise.type)) throw new Error("UNIQUE constraint failed: exercises.item_id, exercises.type");
        exercises.push({ ...exercise });
      }
      return Promise.resolve();
    },
    countExercisesByCourse: (userId) => {
      const counts: Record<string, number> = {};
      for (const exercise of exercises.filter((e) => e.userId === userId)) {
        const courseId = items.find((i) => i.id === exercise.itemId)?.courseId;
        if (courseId) counts[courseId] = (counts[courseId] ?? 0) + 1;
      }
      return Promise.resolve(counts);
    },
  };
}

export function courseTexts(texts: Record<string, string>, userId = "u1", grade = "CM1" as const): CourseTextSource {
  return {
    read: (asker, courseId) => {
      if (asker !== userId || !(courseId in texts)) return Promise.resolve(err("not-found"));
      const markdown = texts[courseId];
      return Promise.resolve(markdown === "" ? err("not-ready") : ok({ markdown: markdown ?? "", grade }));
    },
  };
}

export function scriptedSplitter(answers: Result<ItemProposal[], GenerationError>[]): ItemSplitter & { calls: number } {
  const splitter = {
    calls: 0,
    split: () => Promise.resolve(answers[splitter.calls++] ?? err({ kind: "model-error" as const, message: "no scripted answer left" })),
  };
  return splitter;
}

// Answers per type, in call order; records what it was asked.
export function scriptedGenerator(answers: Partial<Record<GameType, Result<unknown[], GenerationError>[]>>): ExerciseGenerator & { asked: { type: GameType; items: string[] }[] } {
  const asked: { type: GameType; items: string[] }[] = [];
  return {
    asked,
    generate: ({ type, items }) => {
      const nth = asked.filter((a) => a.type === type).length;
      asked.push({ type, items: items.map((i) => i.title) });
      return Promise.resolve(answers[type]?.[nth] ?? err({ kind: "model-error", message: `no scripted answer left for ${type}` }));
    },
  };
}

export function fakeJobQueue(): JobQueue & { rows: Job[] } {
  const rows: Job[] = [];
  return {
    rows,
    enqueue: (userId, type, payload, now) => {
      const nowIso = now.toISOString();
      rows.push({ id: `job-${String(rows.length)}`, userId, type, payload, status: "pending", attempts: 0, maxAttempts: 3, lastError: null, runAfter: nowIso, createdAt: nowIso, updatedAt: nowIso });
      return Promise.resolve(`job-${String(rows.length - 1)}`);
    },
    claimNext: () => Promise.resolve(null),
    complete: () => Promise.resolve(),
    fail: () => Promise.resolve(),
    recoverStale: () => Promise.resolve(0),
    listJobs: (userId, type) =>
      Promise.resolve(
        rows
          .filter((row) => row.userId === userId && row.type === type)
          .reverse()
          .map((row) => ({ id: row.id, status: row.status, payload: row.payload, lastError: row.lastError })),
      ),
  };
}

export const sequentialIds = (prefix = "id") => {
  let n = 0;
  return { next: () => `${prefix}-${String(n++)}` };
};
