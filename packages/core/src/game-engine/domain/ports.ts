import type { Exercise, GameType } from "../../exercise-generator/index.js";
import type { Result } from "../../shared/index.js";
import type { AttemptRecord } from "./play.js";

// One row per unit of a submission: never the given answer
// (docs/modules/game-engine.md, "Minimisation").
export type Attempt = { id: string; exerciseId: string; type: GameType; unitId: string; correct: boolean; starEligible: boolean };

export interface AttemptRepository {
  // Every unit of one submission in one short transaction, all at `now`.
  record(userId: string, attempts: Attempt[], now: Date): Promise<void>;
  listForExercises(userId: string, exerciseIds: string[]): Promise<AttemptRecord[]>;
  // Every attempt of the account, in order: what progress derives from (M5).
  listByUser(userId: string): Promise<AttemptRecord[]>;
}

// exercise-generator's exercises, through its index only.
export interface ExerciseSource {
  findExercise(userId: string, exerciseId: string): Promise<Exercise | null>;
  // In the course's order: items by position, then game types.
  listCourseExercises(userId: string, courseId: string): Promise<Result<{ exercise: Exercise; itemTitle: string }[], "not-found" | "not-ready">>;
}
