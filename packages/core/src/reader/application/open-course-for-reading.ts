import { getCourseText, recordAccess, type CourseRepository, type NotFound } from "../../ingestion/index.js";
import { err, ok, type Result } from "../../shared/index.js";
import { speakableText } from "../domain/speakable-text.js";

export interface OpenCourseForReadingDeps {
  repo: CourseRepository;
}

export type ReadingView = { markdown: string; speech: string; photos: { index: number }[] };

// Composes ingestion only (docs/modules/reader.md): never a reading state
// for a course the child has not confirmed, nor one still being read.
export async function openCourseForReading(deps: OpenCourseForReadingDeps, userId: string, courseId: string, now: Date): Promise<Result<ReadingView, NotFound | "not-ready">> {
  const text = await getCourseText(deps, userId, courseId);
  if (!text.ok) return err(text.error);
  const access = await recordAccess(deps, userId, courseId, now);
  if (!access.ok) return err(access.error);
  const photos = [...text.value.pages].sort((a, b) => a - b).map((index) => ({ index }));
  return ok({ markdown: text.value.markdown, speech: speakableText(text.value.markdown), photos });
}
