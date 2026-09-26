import { err, ok, type IdGenerator, type Result } from "../../shared/index.js";
import { checkAnswer, type ComparisonResult, type GivenAnswer } from "../domain/compare.js";
import { attemptsFor, correctionOf } from "../domain/play.js";
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
): Promise<Result<{ result: ComparisonResult; correction?: GivenAnswer[keyof GivenAnswer] }, "not-found" | "invalid-answer">> {
  const exercise = await deps.exercises.findExercise(userId, exerciseId);
  if (!exercise) return err("not-found");
  const result = checkAnswer(exercise.content, givenAnswer);
  if (!result.ok) return result;
  const attempts = attemptsFor(result.value, options).map((attempt) => ({ ...attempt, id: deps.idGenerator.next(), exerciseId, type: exercise.type }));
  await deps.attempts.record(userId, attempts, now);
  // A wrong answer brings the right one back, to show briefly (M4 closing decision).
  if (result.value.units.every((unit) => unit.correct)) return ok({ result: result.value });
  return ok({ result: result.value, correction: correctionOf(exercise.content) });
}
