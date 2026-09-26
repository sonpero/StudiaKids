// In-memory test doubles for game-engine's ports (CLAUDE.md rule 3).
import type { Exercise } from "../../exercise-generator/index.js";
import { err, ok } from "../../shared/index.js";
import type { AttemptRecord } from "../domain/play.js";
import type { Attempt, AttemptRepository, ExerciseSource } from "../domain/ports.js";

export function fakeAttemptRepository(): AttemptRepository & { rows: (Attempt & { userId: string; attemptedAt: string })[] } {
  const rows: (Attempt & { userId: string; attemptedAt: string })[] = [];
  return {
    rows,
    record: (userId, attempts, now) => {
      rows.push(...attempts.map((attempt) => ({ ...attempt, userId, attemptedAt: now.toISOString() })));
      return Promise.resolve();
    },
    listForExercises: (userId, exerciseIds) =>
      Promise.resolve(
        rows
          .filter((row) => row.userId === userId && exerciseIds.includes(row.exerciseId))
          .map(({ exerciseId, attemptedAt, correct, starEligible }): AttemptRecord => ({ exerciseId, attemptedAt, correct, starEligible })),
      ),
  };
}

// courses: courseId -> { owner, ready, exercises in order with their item's title }.
export function fakeExerciseSource(courses: Record<string, { userId: string; ready?: boolean; exercises: { exercise: Exercise; itemTitle: string }[] }>): ExerciseSource {
  const all = Object.values(courses).flatMap((course) => course.exercises.map((entry) => entry.exercise));
  return {
    findExercise: (userId, exerciseId) => Promise.resolve(all.find((exercise) => exercise.userId === userId && exercise.id === exerciseId) ?? null),
    listCourseExercises: (userId, courseId) => {
      const course = courses[courseId];
      if (!course || course.userId !== userId) return Promise.resolve(err("not-found" as const));
      if (course.ready === false) return Promise.resolve(err("not-ready" as const));
      return Promise.resolve(ok(course.exercises.map((entry) => ({ ...entry, exercise: { ...entry.exercise } }))));
    },
  };
}

export const sequentialIds = (prefix = "a") => {
  let n = 0;
  return { next: () => `${prefix}-${String(n++)}` };
};
