import { describe, expect, it } from "vitest";
import { ok } from "../../shared/index.js";
import { addPage } from "./add-page.js";
import { confirmCourse } from "./confirm-course.js";
import { createCourse } from "./create-course.js";
import { fakeCourseRepository, fakeFileStore, fakeJobQueue, legiblePage, scriptedCourseNamer, scriptedPhotoExtractor, sequentialIds, tinyJpeg } from "./fakes.js";
import { getCourseText } from "./get-course-text.js";
import { handleExtractionJob } from "./handle-extraction-job.js";

const now = new Date("2026-09-26T10:00:00.000Z");

async function readyCourse(confirm: boolean) {
  const deps = { repo: fakeCourseRepository(), fileStore: fakeFileStore(), idGenerator: sequentialIds(), jobQueue: fakeJobQueue() };
  await createCourse(deps, "u1", "CE2", now);
  await addPage(deps, "u1", "course-0", tinyJpeg(1), now);
  await addPage(deps, "u1", "course-0", tinyJpeg(2), now);
  await handleExtractionJob(
    { ...deps, extractor: scriptedPhotoExtractor([legiblePage("# Les nombres"), legiblePage("## Comparer")]), namer: scriptedCourseNamer(ok({ title: "Les nombres", subject: "maths" as const })) },
    { courseId: "course-0" },
    { jobId: "j", userId: "u1", attempt: 1, now },
  );
  if (confirm) await confirmCourse(deps, "u1", "course-0", now);
  return deps;
}

// For the reader and the generator (M3): the text of a course the child
// confirmed, with its grade and its pages, through ingestion's index.
describe("getCourseText", () => {
  it("gives the extracted Markdown, the course's grade and its page indexes, in order", async () => {
    const deps = await readyCourse(true);

    expect(await getCourseText(deps, "u1", "course-0")).toEqual(ok({ markdown: "# Les nombres\n\n## Comparer", grade: "CE2", pages: [0, 1] }));
  });

  it("refuses a course not confirmed yet", async () => {
    const deps = await readyCourse(false);

    expect(await getCourseText(deps, "u1", "course-0")).toEqual({ ok: false, error: "not-ready" });
  });

  it("treats another account's course like an unknown one", async () => {
    const deps = await readyCourse(true);

    expect(await getCourseText(deps, "u2", "course-0")).toEqual({ ok: false, error: "not-found" });
    expect(await getCourseText(deps, "u1", "nope")).toEqual({ ok: false, error: "not-found" });
  });
});
