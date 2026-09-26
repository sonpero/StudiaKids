import { GAME_TYPES, type CourseTextSource, type Exercise, type ItemRepository } from "../../exercise-generator/index.js";
import { err, ok } from "../../shared/index.js";
import type { ExerciseSource } from "../domain/ports.js";

// exercise-generator's exercises, read through its index: a course is
// listed only once its text is confirmed and ready, and only for its owner.
export class GeneratedExercises implements ExerciseSource {
  constructor(
    private readonly items: ItemRepository,
    private readonly courses: CourseTextSource,
  ) {}

  findExercise(userId: string, exerciseId: string): Promise<Exercise | null> {
    return this.items.findExercise(userId, exerciseId);
  }

  async listCourseExercises(userId: string, courseId: string): ReturnType<ExerciseSource["listCourseExercises"]> {
    const text = await this.courses.read(userId, courseId);
    if (!text.ok) return err(text.error);
    const items = await this.items.listItems(userId, courseId);
    const exercises = await this.items.listExercises(
      userId,
      items.map((item) => item.id),
    );
    return ok(
      items.flatMap((item) =>
        exercises
          .filter((exercise) => exercise.itemId === item.id)
          .sort((a, b) => GAME_TYPES.indexOf(a.type) - GAME_TYPES.indexOf(b.type))
          .map((exercise) => ({ exercise, itemTitle: item.title })),
      ),
    );
  }
}
