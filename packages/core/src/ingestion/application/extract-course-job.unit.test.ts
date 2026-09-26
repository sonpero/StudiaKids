import { describe, expect, it } from "vitest";
import { addPage } from "./add-page.js";
import { createCourse } from "./create-course.js";
import { extractCourseJobHandler } from "./extract-course-job.js";
import { fakeCourseRepository, fakeFileStore, legiblePage, scriptedCourseNamer, scriptedPhotoExtractor, sequentialIds, tinyJpeg } from "./fakes.js";
import { ok } from "../../shared/index.js";

const now = new Date("2026-09-26T10:00:00.000Z");

describe("extractCourseJobHandler", () => {
  it("is registered under extract-course and only accepts a payload with a course id", () => {
    const handler = extractCourseJobHandler({ repo: fakeCourseRepository(), fileStore: fakeFileStore(), extractor: scriptedPhotoExtractor([]), namer: scriptedCourseNamer(ok({ title: "x", subject: "maths" })) });

    expect(handler.type).toBe("extract-course");
    expect(handler.payloadSchema.safeParse({ courseId: "course-0" }).success).toBe(true);
    expect(handler.payloadSchema.safeParse({}).success).toBe(false);
    expect(handler.payloadSchema.safeParse({ courseId: 42 }).success).toBe(false);
  });

  it("runs the extraction for the job's account", async () => {
    const repo = fakeCourseRepository();
    const fileStore = fakeFileStore();
    await createCourse({ repo, fileStore, idGenerator: sequentialIds() }, "u1", "CM1", now);
    await addPage({ repo, fileStore }, "u1", "course-0", tinyJpeg(1), now);
    const handler = extractCourseJobHandler({ repo, fileStore, extractor: scriptedPhotoExtractor([legiblePage("# Les fractions")]), namer: scriptedCourseNamer(ok({ title: "Les fractions", subject: "maths" })) });

    expect(await handler.handle({ courseId: "course-0" }, { jobId: "j", userId: "u1", attempt: 1, now })).toEqual(ok(undefined));
    expect(repo.courses[0]).toMatchObject({ extractionStatus: "ready", title: "Les fractions" });
  });
});
