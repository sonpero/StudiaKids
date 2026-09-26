import { describe, expect, it } from "vitest";
import { ok } from "../../shared/index.js";
import { addPage } from "./add-page.js";
import { createCourse } from "./create-course.js";
import { fakeCourseRepository, fakeFileStore, legiblePage, scriptedCourseNamer, scriptedPhotoExtractor, sequentialIds, tinyJpeg } from "./fakes.js";
import { handleExtractionJob } from "./handle-extraction-job.js";

const now = new Date("2026-09-26T10:00:00.000Z");
const ctx = { jobId: "job-0", userId: "u1", attempt: 1, now };
const named = ok({ title: "Le verbe", subject: "french" as const });

async function courseWithPages(pageCount: number) {
  const repo = fakeCourseRepository();
  const fileStore = fakeFileStore();
  await createCourse({ repo, fileStore, idGenerator: sequentialIds() }, "u1", "CM1", now);
  for (let seed = 1; seed <= pageCount; seed++) await addPage({ repo, fileStore }, "u1", "course-0", tinyJpeg(seed), now);
  return { repo, fileStore };
}

// Decided at M2 (2026-09-26): the Markdown already read is kept between
// attempts, page by page; a retry never pays for a page twice.
describe("handleExtractionJob keeps what it already read", () => {
  it("a retry after a failure past the reading (naming, final write) never extracts again", async () => {
    const { repo, fileStore } = await courseWithPages(1);
    const complete = repo.completeExtraction.bind(repo);
    let failOnce = true;
    repo.completeExtraction = (...args) => {
      if (failOnce) {
        failOnce = false;
        return Promise.reject(new Error("database is locked"));
      }
      return complete(...args);
    };
    const first = scriptedPhotoExtractor([legiblePage("# Le verbe\n\n## Le sujet")]);
    await expect(handleExtractionJob({ repo, fileStore, extractor: first, namer: scriptedCourseNamer(named) }, { courseId: "course-0" }, ctx)).rejects.toThrow();

    const second = scriptedPhotoExtractor([]);
    const namer = scriptedCourseNamer(named);
    const result = await handleExtractionJob({ repo, fileStore, extractor: second, namer }, { courseId: "course-0" }, ctx);

    expect(result).toEqual(ok(undefined));
    expect(second.calls).toBe(0);
    expect(namer.inputs).toEqual(["# Le verbe\n\n## Le sujet"]);
    expect(repo.courses[0]).toMatchObject({ extractionStatus: "ready", title: "Le verbe" });
  });

  it("a retry after the second page failed reads only that page again", async () => {
    const { repo, fileStore } = await courseWithPages(2);
    const first = scriptedPhotoExtractor([legiblePage("# Le verbe")]);
    expect((await handleExtractionJob({ repo, fileStore, extractor: first, namer: scriptedCourseNamer(named) }, { courseId: "course-0" }, ctx)).ok).toBe(false);

    const second = scriptedPhotoExtractor([legiblePage("## Suite")]);
    const namer = scriptedCourseNamer(named);
    await handleExtractionJob({ repo, fileStore, extractor: second, namer }, { courseId: "course-0" }, ctx);

    expect(first.calls).toBe(2);
    expect(second.calls).toBe(1);
    expect(namer.inputs).toEqual(["# Le verbe\n\n## Suite"]);
    expect(repo.extractions).toHaveLength(1);
  });
});
