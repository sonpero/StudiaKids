import { describe, expect, it } from "vitest";
import { err, ok } from "../../shared/index.js";
import { addPage } from "./add-page.js";
import { createCourse } from "./create-course.js";
import { fakeCourseRepository, fakeFileStore, fakeJobQueue, legiblePage, scriptedCourseNamer, scriptedPhotoExtractor, sequentialIds, tinyJpeg } from "./fakes.js";
import { getCourse } from "./get-course.js";
import { handleExtractionJob } from "./handle-extraction-job.js";
import { retryExtraction } from "./retry-extraction.js";
import { startExtraction } from "./start-extraction.js";

const now = new Date("2026-09-25T10:00:00.000Z");
const ctx = { jobId: "job-0", userId: "u1", attempt: 1, now };
const named = ok({ title: "Les fractions", subject: "maths" as const });

async function courseWithPages(pageCount: number) {
  const repo = fakeCourseRepository();
  const fileStore = fakeFileStore();
  const jobQueue = fakeJobQueue();
  const base = { repo, fileStore, idGenerator: sequentialIds(), jobQueue };
  await createCourse(base, "u1", "CM1", now);
  for (let seed = 1; seed <= pageCount; seed++) await addPage(base, "u1", "course-0", tinyJpeg(seed), now);
  return { repo, fileStore, jobQueue, base };
}

describe("startExtraction", () => {
  it("enqueues one extract-course job for the course", async () => {
    const { jobQueue, base } = await courseWithPages(1);

    expect(await startExtraction(base, "u1", "course-0", now)).toEqual({ ok: true, value: undefined });
    expect(jobQueue.rows).toMatchObject([{ userId: "u1", type: "extract-course", payload: { courseId: "course-0" }, status: "pending" }]);
  });

  it("does not enqueue a second job while one is already waiting (double tap)", async () => {
    const { jobQueue, base } = await courseWithPages(1);
    await startExtraction(base, "u1", "course-0", now);

    await startExtraction(base, "u1", "course-0", now);

    expect(jobQueue.rows).toHaveLength(1);
  });

  it("refuses a course without any photo, and another account's course", async () => {
    const { jobQueue, base } = await courseWithPages(0);

    expect(await startExtraction(base, "u1", "course-0", now)).toEqual({ ok: false, error: "no-pages" });
    expect(await startExtraction(base, "u2", "course-0", now)).toEqual({ ok: false, error: "not-found" });
    expect(jobQueue.rows).toHaveLength(0);
  });
});

describe("handleExtractionJob", () => {
  it("with every page usable: concatenates the pages in order, names the course, derives its color, marks it ready", async () => {
    const { repo, base } = await courseWithPages(2);
    const extractor = scriptedPhotoExtractor([legiblePage("# Les fractions\n\n## Moitié"), legiblePage("## Quart")]);
    const namer = scriptedCourseNamer(named);

    const result = await handleExtractionJob({ ...base, extractor, namer }, { courseId: "course-0" }, ctx);

    expect(result).toEqual({ ok: true, value: undefined });
    expect(repo.extractions).toEqual([{ courseId: "course-0", markdown: "# Les fractions\n\n## Moitié\n\n## Quart", extractedAt: now.toISOString() }]);
    expect(namer.inputs).toEqual(["# Les fractions\n\n## Moitié\n\n## Quart"]);
    expect(repo.courses[0]).toMatchObject({ title: "Les fractions", subject: "maths", color: "matiere-maths", extractionStatus: "ready", confirmed: false });
    expect(repo.pages.map((p) => [p.legible, p.isCoursePage])).toEqual([
      [true, true],
      [true, true],
    ]);
  });

  // Acceptance (docs/jalons.md, M2): legibility is checked before any later
  // step. An illegible page stops everything: no naming, no extraction row,
  // nothing enqueued, and no model call spent on the remaining pages.
  it("with an illegible page: stops there, never names the course, writes no extraction, enqueues nothing", async () => {
    const { repo, jobQueue, base } = await courseWithPages(3);
    const extractor = scriptedPhotoExtractor([legiblePage("# A"), ok({ markdown: "", legible: false, isCoursePage: false, reason: "trop flou" }), legiblePage("# C")]);
    const namer = scriptedCourseNamer(named);

    const result = await handleExtractionJob({ ...base, extractor, namer }, { courseId: "course-0" }, ctx);

    expect(result).toEqual({ ok: true, value: undefined });
    expect(repo.courses[0]?.extractionStatus).toBe("illegible");
    expect(namer.inputs).toEqual([]);
    expect(repo.extractions).toEqual([]);
    expect(jobQueue.rows).toEqual([]);
    expect(extractor.calls).toBe(2);
    expect(repo.pages.map((p) => [p.legible, p.unusableReason])).toEqual([
      [true, null],
      [false, "trop flou"],
      [null, null],
    ]);
  });

  it("with a legible photo that shows no lesson: not_a_course_page, same stop as an illegible one", async () => {
    const { repo, base } = await courseWithPages(1);
    const namer = scriptedCourseNamer(named);

    await handleExtractionJob({ ...base, extractor: scriptedPhotoExtractor([ok({ markdown: "", legible: true, isCoursePage: false, reason: "un chat" })]), namer }, { courseId: "course-0" }, ctx);

    expect(repo.courses[0]?.extractionStatus).toBe("not_a_course_page");
    expect(repo.pages[0]).toMatchObject({ legible: true, isCoursePage: false, unusableReason: "un chat" });
    expect(namer.inputs).toEqual([]);
    expect(repo.extractions).toEqual([]);
  });

  it("returns the model error so the jobs kernel retries, leaving the course running and unnamed", async () => {
    const { repo, base } = await courseWithPages(1);
    const extractor = scriptedPhotoExtractor([err({ kind: "model-error", message: "overloaded" })]);

    const result = await handleExtractionJob({ ...base, extractor, namer: scriptedCourseNamer(named) }, { courseId: "course-0" }, ctx);

    expect(result).toEqual({ ok: false, error: "overloaded" });
    expect(repo.courses[0]?.extractionStatus).toBe("running");
    expect(repo.extractions).toEqual([]);
  });

  it("returns the naming error too, without writing a half-finished extraction", async () => {
    const { repo, base } = await courseWithPages(1);

    const result = await handleExtractionJob(
      { ...base, extractor: scriptedPhotoExtractor([legiblePage("# A")]), namer: scriptedCourseNamer(err({ kind: "model-error", message: "bad schema" })) },
      { courseId: "course-0" },
      ctx,
    );

    expect(result).toEqual({ ok: false, error: "bad schema" });
    expect(repo.extractions).toEqual([]);
    expect(repo.courses[0]?.extractionStatus).toBe("running");
  });

  it("is idempotent: a retry after a failure leaves exactly one extraction and fresh page results", async () => {
    const { repo, base } = await courseWithPages(1);
    await handleExtractionJob({ ...base, extractor: scriptedPhotoExtractor([err({ kind: "model-error", message: "x" })]), namer: scriptedCourseNamer(named) }, { courseId: "course-0" }, ctx);

    await handleExtractionJob({ ...base, extractor: scriptedPhotoExtractor([legiblePage("# A")]), namer: scriptedCourseNamer(named) }, { courseId: "course-0" }, ctx);

    expect(repo.extractions).toHaveLength(1);
    expect(repo.courses[0]?.extractionStatus).toBe("ready");
  });

  it("does not redo (nor pay for) a course whose result is already stored, e.g. a job re-run after a crash", async () => {
    const { repo, base } = await courseWithPages(1);
    await handleExtractionJob({ ...base, extractor: scriptedPhotoExtractor([legiblePage("# A")]), namer: scriptedCourseNamer(named) }, { courseId: "course-0" }, ctx);
    const secondExtractor = scriptedPhotoExtractor([legiblePage("# B")]);

    const result = await handleExtractionJob({ ...base, extractor: secondExtractor, namer: scriptedCourseNamer(named) }, { courseId: "course-0" }, ctx);

    expect(result).toEqual({ ok: true, value: undefined });
    expect(secondExtractor.calls).toBe(0);
    expect(repo.extractions.map((e) => e.markdown)).toEqual(["# A"]);
  });

  it("ends quietly when the course was deleted in the meantime (e.g. replaced by a new photo)", async () => {
    const { repo, base } = await courseWithPages(1);
    await repo.deleteCourse("u1", "course-0");
    const extractor = scriptedPhotoExtractor([legiblePage("# A")]);

    expect(await handleExtractionJob({ ...base, extractor, namer: scriptedCourseNamer(named) }, { courseId: "course-0" }, ctx)).toEqual({ ok: true, value: undefined });
    expect(extractor.calls).toBe(0);
  });

  it("only ever acts for the job's own account", async () => {
    const { repo, base } = await courseWithPages(1);
    const extractor = scriptedPhotoExtractor([legiblePage("# A")]);
    const namer = scriptedCourseNamer(named);

    await handleExtractionJob({ ...base, extractor, namer }, { courseId: "course-0" }, { ...ctx, userId: "u2" });

    expect(extractor.calls).toBe(0);
    expect(namer.inputs).toEqual([]);
    expect(repo.courses[0]?.extractionStatus).toBe("pending");
  });
});

describe("getCourse and retryExtraction", () => {
  it("shows running while the job waits for a retry, failed once the job is exhausted", async () => {
    const { jobQueue, repo, base } = await courseWithPages(1);
    await startExtraction(base, "u1", "course-0", now);
    await repo.setExtractionStatus("u1", "course-0", "running");

    const running = await getCourse(base, "u1", "course-0");
    jobQueue.rows[0]!.status = "failed";
    const failed = await getCourse(base, "u1", "course-0");

    expect(running.ok && running.value.extractionStatus).toBe("running");
    expect(failed.ok && failed.value.extractionStatus).toBe("failed");
  });

  it("retries only a technical failure: back to pending, with a new job", async () => {
    const { jobQueue, repo, base } = await courseWithPages(1);
    await startExtraction(base, "u1", "course-0", now);
    await repo.setExtractionStatus("u1", "course-0", "running");
    jobQueue.rows[0]!.status = "failed";

    expect(await retryExtraction(base, "u1", "course-0", now)).toEqual({ ok: true, value: undefined });
    expect(repo.courses[0]?.extractionStatus).toBe("pending");
    expect(jobQueue.rows.map((j) => j.status)).toEqual(["failed", "pending"]);
    const after = await getCourse(base, "u1", "course-0");
    expect(after.ok && after.value.extractionStatus).toBe("pending");
  });

  it("refuses to retry an illegible photo or a course still in progress: the child retakes the photo instead", async () => {
    const { repo, base } = await courseWithPages(1);
    await startExtraction(base, "u1", "course-0", now);
    await repo.setExtractionStatus("u1", "course-0", "illegible");

    expect(await retryExtraction(base, "u1", "course-0", now)).toEqual({ ok: false, error: "not-failed" });
    await repo.setExtractionStatus("u1", "course-0", "running");
    expect(await retryExtraction(base, "u1", "course-0", now)).toEqual({ ok: false, error: "not-failed" });
  });
});
