import type { GetCourseDeps, CourseView } from "./get-course.js";
import { toCourseView } from "./get-course.js";

// For the home banner: the account's one pending course, if any.
export async function getUnconfirmedCourse(deps: GetCourseDeps, userId: string): Promise<CourseView | null> {
  const course = await deps.repo.findUnconfirmedCourse(userId);
  return course ? toCourseView(deps.jobQueue, course) : null;
}
