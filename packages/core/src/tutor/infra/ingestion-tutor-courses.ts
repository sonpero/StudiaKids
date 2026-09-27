import { getCourseText, type CourseRepository, type Subject } from "../../ingestion/index.js";
import { err, ok, type Result } from "../../shared/index.js";
import type { CourseForTutor, TutorCourseSource } from "../domain/ports.js";

// The prompts are in French: the subject is named as a child would.
const SUBJECT_NAMES: Record<Subject, string> = { maths: "mathématiques", french: "français", history: "histoire", geography: "géographie", science: "sciences", english: "anglais", other: "autre" };

// A course the child confirmed and that was read: the tutor never talks
// about anything else.
export class IngestionTutorCourses implements TutorCourseSource {
  constructor(private readonly repo: CourseRepository) {}

  async read(userId: string, courseId: string): Promise<Result<CourseForTutor, "not-found" | "not-ready">> {
    const text = await getCourseText({ repo: this.repo }, userId, courseId);
    if (!text.ok) return err(text.error);
    const course = await this.repo.findCourse(userId, courseId);
    if (!course) return err("not-found");
    return ok({ title: course.title, subject: course.subject === null ? "non précisée" : SUBJECT_NAMES[course.subject], grade: text.value.grade, markdown: text.value.markdown });
  }
}
