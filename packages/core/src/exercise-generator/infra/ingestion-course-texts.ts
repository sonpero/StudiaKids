import { getCourseText, type CourseRepository } from "../../ingestion/index.js";
import { err, ok } from "../../shared/index.js";
import type { CourseTextSource } from "../domain/ports.js";
import type { CourseSubject } from "../domain/subject-rules.js";

// A course's text as ingestion gives it: only a confirmed, ready course
// is ever split or generated.
export class IngestionCourseTexts implements CourseTextSource {
  constructor(private readonly repo: CourseRepository) {}

  async read(userId: string, courseId: string): ReturnType<CourseTextSource["read"]> {
    const text = await getCourseText({ repo: this.repo }, userId, courseId);
    if (!text.ok) return err(text.error);
    return ok({ markdown: text.value.markdown, grade: text.value.grade });
  }

  async readSubject(userId: string, courseId: string): Promise<CourseSubject> {
    return (await this.repo.findCourse(userId, courseId))?.subject ?? null;
  }
}
