import type { JobContext, JobError } from "../../jobs/index.js";
import { err, ok, type Result } from "../../shared/index.js";
import { resolveCourseName } from "../domain/course-name.js";
import { outcomeOfPages } from "../domain/extraction.js";
import type { CourseNamer, CourseRepository, FileStore, PhotoExtractor } from "../domain/ports.js";
import { subjectColor } from "../domain/subject.js";
import type { ExtractCoursePayload } from "./latest-job.js";

export interface HandleExtractionJobDeps {
  repo: CourseRepository;
  fileStore: FileStore;
  extractor: PhotoExtractor;
  namer: CourseNamer;
}

const RESULT_STATUSES = new Set(["ready", "illegible", "not_a_course_page"]);

// Reads pages in order, one model call per page, and stops at the first
// unusable one: legibility gates naming, and nothing is ever enqueued after
// it (generation is started by hand, M3). Idempotent: a re-run starts from
// clean page results, a course whose result is already stored is left
// alone, and completeExtraction replaces any extraction in the same
// transaction that sets `ready` — so one only ever exists for a ready
// course. No model call happens inside a transaction:
// each repository call below is its own short write.
export async function handleExtractionJob(deps: HandleExtractionJobDeps, payload: ExtractCoursePayload, ctx: JobContext): Promise<Result<void, JobError>> {
  const course = await deps.repo.findCourse(ctx.userId, payload.courseId);
  // Deleted meanwhile (rejected, or replaced by a new photo): nothing to do.
  if (!course) return ok(undefined);
  if (RESULT_STATUSES.has(course.extractionStatus)) return ok(undefined);

  await deps.repo.setExtractionStatus(ctx.userId, course.id, "running");
  await deps.repo.resetPageResults(ctx.userId, course.id);

  const pages = await deps.repo.listPages(ctx.userId, course.id);
  const markdownParts: string[] = [];
  for (const page of pages) {
    const bytes = await deps.fileStore.read(page.storedPath);
    const extracted = await deps.extractor.extract({ bytes });
    if (!extracted.ok) return err(extracted.error.message);

    const { legible, isCoursePage, reason } = extracted.value;
    const result = { legible, isCoursePage: legible ? isCoursePage : null, unusableReason: legible && isCoursePage ? null : (reason ?? null) };
    await deps.repo.recordPageResult(ctx.userId, course.id, page.index, result);
    page.legible = result.legible;
    page.isCoursePage = result.isCoursePage;

    const outcome = outcomeOfPages([page]);
    if (outcome === "illegible" || outcome === "not_a_course_page") {
      await deps.repo.setExtractionStatus(ctx.userId, course.id, outcome);
      return ok(undefined);
    }
    markdownParts.push(extracted.value.markdown);
  }

  const markdown = markdownParts.join("\n\n");
  // Naming never fails a course (docs/modules/ingestion.md): an unusable
  // answer, or none, falls back field by field.
  const named = await deps.namer.suggest({ markdown });
  const { title, subject } = resolveCourseName(named.ok ? named.value : null, markdown);

  await deps.repo.completeExtraction(ctx.userId, course.id, { markdown, title, subject, color: subjectColor(subject) }, ctx.now);
  return ok(undefined);
}
