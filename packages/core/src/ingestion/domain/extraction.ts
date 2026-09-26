import type { JobStatus } from "../../jobs/index.js";
import type { ExtractionStatus, Page, StoredExtractionStatus } from "./types.js";

export type PagesOutcome = "illegible" | "not_a_course_page" | "ready" | "in_progress";

// Legibility is checked first and gates everything after it: a course is
// never ready (hence never named, never handed to generation) while a page
// is unusable. Illegible wins over not_a_course_page, since the content of
// a photo that cannot be read is never judged.
export function outcomeOfPages(pages: Page[]): PagesOutcome {
  if (pages.some((page) => page.legible === false)) return "illegible";
  if (pages.some((page) => page.isCoursePage === false)) return "not_a_course_page";
  if (pages.length === 0 || pages.some((page) => page.legible === null || page.isCoursePage === null)) return "in_progress";
  return "ready";
}

const RESULT_STATUSES: ReadonlySet<StoredExtractionStatus> = new Set(["illegible", "not_a_course_page", "ready"]);

// Only the job knows whether a technical failure is final (retries are
// the jobs kernel's business), so `failed` is derived here, at read time.
// A stored result always wins: it was written, whatever happened next.
export function displayStatus(stored: StoredExtractionStatus, latestJobStatus: JobStatus | null): ExtractionStatus {
  if (RESULT_STATUSES.has(stored)) return stored;
  return latestJobStatus === "failed" ? "failed" : stored;
}

// Whether the reading was ever launched. A pending course with no job yet
// was left on the capture screen before « C'est tout ! »: the home banner
// takes the child back there, never to a waiting screen with nothing
// running (docs/ui.md).
export function extractionStarted(stored: StoredExtractionStatus, latestJobStatus: JobStatus | null): boolean {
  return stored !== "pending" || latestJobStatus !== null;
}
