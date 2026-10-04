import type { CourseRepository, FileStore } from "../domain/ports.js";
import { deleteCourse } from "./delete-course.js";

// An unconfirmed course nobody came back to: the home banner offers to
// finish it for a week, then it goes, photos included (docs/securite.md).
// A new capture replaces it sooner (createCourse).
export const ABANDONED_COURSE_MAX_AGE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface PurgeAbandonedCourseDeps {
  repo: CourseRepository;
  fileStore: FileStore;
}

// Whether the account's unconfirmed course was purged.
export async function purgeAbandonedCourse(deps: PurgeAbandonedCourseDeps, userId: string, now: Date): Promise<boolean> {
  const course = await deps.repo.findUnconfirmedCourse(userId);
  if (!course || now.getTime() - Date.parse(course.createdAt) < ABANDONED_COURSE_MAX_AGE_DAYS * DAY_MS) return false;
  return (await deleteCourse(deps, userId, course.id)).ok;
}
