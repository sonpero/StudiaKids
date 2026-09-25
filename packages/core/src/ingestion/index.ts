export type { Course, Page, Extraction, ExtractionStatus, StoredExtractionStatus } from "./domain/types.js";
export type {
  FileStore,
  PhotoExtractor,
  PhotoExtraction,
  CourseNamer,
  CourseNameSuggestion,
  ExtractionError,
} from "./domain/ports.js";
export { SUBJECTS, subjectColor, type Subject } from "./domain/subject.js";
export { MAX_PAGES_PER_COURSE, canAddPage, nextPageIndex } from "./domain/pages.js";
export { MAX_PAGE_BYTES, isAcceptable, sniffImageType, stripJpegMetadata, type ImageType } from "./domain/photo.js";
export { outcomeOfPages, displayStatus, type PagesOutcome } from "./domain/extraction.js";
