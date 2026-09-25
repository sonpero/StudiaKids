import type { CourseRepository } from "../domain/ports.js";
import type { Course } from "../domain/types.js";

export interface ListConfirmedCoursesDeps {
  repo: CourseRepository;
}

// Most recently opened first, for "Reprendre un cours existant". A
// confirmed course is always ready, so no job lookup is needed.
export function listConfirmedCourses(deps: ListConfirmedCoursesDeps, userId: string): Promise<Course[]> {
  return deps.repo.listConfirmedCourses(userId);
}
