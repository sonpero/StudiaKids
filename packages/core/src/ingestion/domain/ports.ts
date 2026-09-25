import type { Result } from "../../shared/index.js";
import type { Subject } from "./subject.js";

export interface FileStore {
  put(userId: string, courseId: string, pageIndex: number, bytes: Uint8Array): Promise<string>;
  read(storedPath: string): Promise<Uint8Array>;
  // Removes the whole course directory: a photo never outlives its course.
  deleteCourse(userId: string, courseId: string): Promise<void>;
}

export type ExtractionError = { kind: "model-error"; message: string };

// legible/isCoursePage false are business results, not errors: they stop
// the pipeline before any naming or generation (docs/modules/ingestion.md).
export type PhotoExtraction = { markdown: string; legible: boolean; isCoursePage: boolean; reason?: string };

export interface PhotoExtractor {
  extract(input: { bytes: Uint8Array }): Promise<Result<PhotoExtraction, ExtractionError>>;
}

export type CourseNameSuggestion = { title: string; subject: Subject };

export interface CourseNamer {
  suggest(input: { markdown: string }): Promise<Result<CourseNameSuggestion, ExtractionError>>;
}
