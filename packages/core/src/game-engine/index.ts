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
export { attemptsFor, displayDurationMs, isSuccess, nextExercise, playableView, type AttemptRecord, type NewAttempt, type PlayableExercise } from "./domain/play.js";
