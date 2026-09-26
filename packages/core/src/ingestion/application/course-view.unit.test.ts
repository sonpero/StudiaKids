import { describe, expect, it } from "vitest";
import { addPage } from "./add-page.js";
import { createCourse } from "./create-course.js";
import { fakeCourseRepository, fakeFileStore, fakeJobQueue, sequentialIds, tinyJpeg } from "./fakes.js";
import { getCourse } from "./get-course.js";
import { getUnconfirmedCourse } from "./get-unconfirmed-course.js";
import { startExtraction } from "./start-extraction.js";

const now = new Date("2026-09-26T10:00:00.000Z");

describe("the course view tells whether the reading was ever launched", () => {
  it("not before « C'est tout ! », yes right after", async () => {
    const deps = { repo: fakeCourseRepository(), fileStore: fakeFileStore(), idGenerator: sequentialIds(), jobQueue: fakeJobQueue() };
    await createCourse(deps, "u1", "CM1", now);
    await addPage(deps, "u1", "course-0", tinyJpeg(1), now);

    expect(await getUnconfirmedCourse(deps, "u1")).toMatchObject({ extractionStatus: "pending", extractionStarted: false });
    await startExtraction(deps, "u1", "course-0", now);

    const after = await getCourse(deps, "u1", "course-0");
    expect(after.ok && after.value).toMatchObject({ extractionStatus: "pending", extractionStarted: true });
  });
});
