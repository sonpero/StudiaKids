export type { Course, Page, Extraction, ExtractionStatus, StoredExtractionStatus } from "./domain/types.js";
export type {
  FileStore,
  PhotoExtractor,
  PhotoExtraction,
  CourseNamer,
  CourseNameSuggestion,
  ExtractionError,
  CourseRepository,
  PageResult,
  CompletedExtraction,
} from "./domain/ports.js";
export { SUBJECTS, subjectColor, type Subject } from "./domain/subject.js";
export { MAX_PAGES_PER_COURSE, canAddPage, nextPageIndex } from "./domain/pages.js";
export { MAX_PAGE_BYTES, isAcceptable, sniffImageType, stripJpegMetadata, type ImageType } from "./domain/photo.js";
export { outcomeOfPages, displayStatus, type PagesOutcome } from "./domain/extraction.js";

export { createCourse, type CreateCourseDeps } from "./application/create-course.js";
export { addPage, type AddPageDeps, type AddPageError } from "./application/add-page.js";
export { startExtraction, type StartExtractionDeps } from "./application/start-extraction.js";
export { handleExtractionJob, type HandleExtractionJobDeps } from "./application/handle-extraction-job.js";
export { EXTRACT_COURSE_JOB, type ExtractCoursePayload } from "./application/latest-job.js";
export { getCourse, type GetCourseDeps, type CourseView } from "./application/get-course.js";
export { getUnconfirmedCourse } from "./application/get-unconfirmed-course.js";
export { listConfirmedCourses, type ListConfirmedCoursesDeps } from "./application/list-confirmed-courses.js";
export { confirmCourse, type ConfirmCourseDeps } from "./application/confirm-course.js";
export { rejectCourse } from "./application/reject-course.js";
export { retryExtraction } from "./application/retry-extraction.js";
export { readPageFile, type ReadPageFileDeps } from "./application/read-page-file.js";
export { recordAccess, type RecordAccessDeps } from "./application/record-access.js";
export { deleteCourse, type DeleteCourseDeps } from "./application/delete-course.js";
export type { NotFound } from "./application/errors.js";

export { ClaudePhotoExtractor } from "./infra/claude-photo-extractor.js";
export { ClaudeCourseNamer } from "./infra/claude-course-namer.js";
