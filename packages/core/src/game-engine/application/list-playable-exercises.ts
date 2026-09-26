import type { Grade } from "../../auth/index.js";
import { err, ok, type Result } from "../../shared/index.js";
import { nextExercise, playableView, type PlayableExercise } from "../domain/play.js";
import type { AttemptRepository, ExerciseSource } from "../domain/ports.js";

export interface ListPlayableExercisesDeps {
  exercises: ExerciseSource;
  attempts: AttemptRepository;
}

// The Jouer screen's list: the playable view of each exercise (never an
// answer) and the next one to play (docs/modules/game-engine.md).
export async function listPlayableExercises(
  deps: ListPlayableExercisesDeps,
  userId: string,
  courseId: string,
  grade: Grade,
): Promise<Result<{ exercises: PlayableExercise[]; nextExerciseId: string | null }, "not-found" | "not-ready">> {
  const listed = await deps.exercises.listCourseExercises(userId, courseId);
  if (!listed.ok) return err(listed.error);
  const ids = listed.value.map(({ exercise }) => exercise.id);
  const attempts = await deps.attempts.listForExercises(userId, ids);
  return ok({
    exercises: listed.value.map(({ exercise, itemTitle }) => playableView({ id: exercise.id, itemTitle, content: exercise.content }, grade)),
    nextExerciseId: nextExercise(ids, attempts),
  });
}
