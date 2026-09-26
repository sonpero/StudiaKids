export {
  checkAnswer,
  compareCloze,
  compareDelayedCopy,
  compareMatching,
  compareMcq,
  compareMentalMath,
  compareReordering,
  compareTrueFalse,
  type ComparisonResult,
  type GivenAnswer,
  type UnitResult,
} from "./domain/compare.js";
export { attemptsFor, correctionOf, displayDurationMs, isSuccess, nextExercise, playableView, type AttemptRecord, type NewAttempt, type PlayableExercise } from "./domain/play.js";
export type { Attempt, AttemptRepository, ExerciseSource } from "./domain/ports.js";

export { playExercise, type PlayExerciseDeps } from "./application/play-exercise.js";
export { listPlayableExercises, type ListPlayableExercisesDeps } from "./application/list-playable-exercises.js";

export { SqliteAttemptRepository, type GameEngineDb } from "./infra/sqlite-attempt-repository.js";
export { GeneratedExercises } from "./infra/generated-exercises.js";
// Exported alongside the other modules' tables (drizzle-kit itself reads
// infra/schema.ts by glob).
export { attemptsTable } from "./infra/schema.js";
