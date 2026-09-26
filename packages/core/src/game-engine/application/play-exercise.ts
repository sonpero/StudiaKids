import { err, ok, type IdGenerator, type Result } from "../../shared/index.js";
import { checkAnswer, type ComparisonResult } from "../domain/compare.js";
import { attemptsFor } from "../domain/play.js";
import type { AttemptRepository, ExerciseSource } from "../domain/ports.js";

export interface PlayExerciseDeps {
  exercises: ExerciseSource;
  attempts: AttemptRepository;
  idGenerator: IdGenerator;
}

// docs/modules/game-engine.md: compares, then writes one attempt per unit —
// never the answer, never a change to the exercise. The exercise is only
// ever loaded for its owner.
export async function playExercise(
  deps: PlayExerciseDeps,
  userId: string,
  exerciseId: string,
  givenAnswer: unknown,
  options: { reread: boolean },
  now: Date,
): Promise<Result<ComparisonResult, "not-found" | "invalid-answer">> {
  const exercise = await deps.exercises.findExercise(userId, exerciseId);
  if (!exercise) return err("not-found");
  const result = checkAnswer(exercise.content, givenAnswer);
  if (!result.ok) return result;
  const attempts = attemptsFor(result.value, options).map((attempt) => ({ ...attempt, id: deps.idGenerator.next(), exerciseId, type: exercise.type }));
  await deps.attempts.record(userId, attempts, now);
  return ok(result.value);
}
