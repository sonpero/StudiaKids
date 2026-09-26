import type { Result } from "../../shared/index.js";
import type { Subject } from "./subject.js";
import type { Course, Extraction, Page, StoredExtractionStatus } from "./types.js";

export interface FileStore {
  put(userId: string, courseId: string, pageIndex: number, bytes: Uint8Array): Promise<string>;
  read(storedPath: string): Promise<Uint8Array>;
  // Removes the whole course directory: a photo never outlives its course.
  deleteCourse(userId: string, courseId: string): Promise<void>;
  // Removes the account's whole photos directory (accounts:delete), orphans
  // included: a photo never outlives its account.
  deleteAccountFiles(userId: string): Promise<void>;
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

export type PageResult = Pick<Page, "legible" | "isCoursePage" | "unusableReason">;
export type CompletedExtraction = { markdown: string; title: string; subject: Subject; color: string };

// Every method takes userId and filters on it (CLAUDE.md rule 1): another
// account's course is indistinguishable from one that does not exist.
// Methods that write several rows do so in one short transaction.
export interface CourseRepository {
  insertCourse(course: Course): Promise<void>;
  findCourse(userId: string, courseId: string): Promise<Course | null>;
  findUnconfirmedCourse(userId: string): Promise<Course | null>;
  listConfirmedCourses(userId: string): Promise<Course[]>; // most recently accessed first
  listPages(userId: string, courseId: string): Promise<Page[]>; // by index
  addPage(userId: string, page: Page): Promise<void>;
  setExtractionStatus(userId: string, courseId: string, status: StoredExtractionStatus): Promise<void>;
  resetPageResults(userId: string, courseId: string): Promise<void>;
  recordPageResult(userId: string, courseId: string, index: number, result: PageResult): Promise<void>;
  // Replaces any existing extraction, sets title/subject/color and `ready`.
  completeExtraction(userId: string, courseId: string, result: CompletedExtraction, now: Date): Promise<void>;
  getExtraction(userId: string, courseId: string): Promise<Extraction | null>;
  confirmCourse(userId: string, courseId: string): Promise<void>;
  touchCourse(userId: string, courseId: string, now: Date): Promise<void>;
  // Rows only (pages and extraction cascade); returns whether it existed.
  deleteCourse(userId: string, courseId: string): Promise<boolean>;
}
