import { describe, expect, it } from "vitest";
import { addPage } from "./add-page.js";
import { createCourse } from "./create-course.js";
import { fakeCourseRepository, fakeFileStore, sequentialIds, tinyJpeg } from "./fakes.js";

const now = new Date("2026-09-25T10:00:00.000Z");

function setup() {
  const repo = fakeCourseRepository();
  const fileStore = fakeFileStore();
  return { repo, fileStore, deps: { repo, fileStore, idGenerator: sequentialIds() } };
}

describe("createCourse", () => {
  it("creates an empty pending course that inherits the account's grade, never a guessed one", async () => {
    const { repo, deps } = setup();

    const result = await createCourse(deps, "u1", "CE2", now);

    expect(result).toEqual({ ok: true, value: { id: "course-0" } });
    expect(repo.courses[0]).toEqual({
      id: "course-0",
      userId: "u1",
      title: "",
      subject: null,
      grade: "CE2",
      color: "",
      extractionStatus: "pending",
      confirmed: false,
      pageCount: 0,
      createdAt: now.toISOString(),
      lastAccessedAt: now.toISOString(),
    });
  });

  it("replaces the account's previous unconfirmed course, rows and photo files included", async () => {
    const { repo, fileStore, deps } = setup();
    await createCourse(deps, "u1", "CE2", now);
    await addPage(deps, "u1", "course-0", tinyJpeg(1), now);

    await createCourse(deps, "u1", "CE2", now);

    expect(repo.courses.map((c) => c.id)).toEqual(["course-1"]);
    expect(repo.pages).toEqual([]);
    expect([...fileStore.files.keys()]).toEqual([]);
    expect(fileStore.calls).toContain("deleteCourse u1/course-0");
  });

  it("never touches confirmed courses, nor another account's unconfirmed one", async () => {
    const { repo, deps } = setup();
    await createCourse(deps, "u1", "CE2", now);
    repo.courses[0]!.confirmed = true;
    await createCourse(deps, "u2", "CP", now);

    await createCourse(deps, "u1", "CE2", now);

    expect(repo.courses.map((c) => [c.id, c.userId])).toEqual([
      ["course-0", "u1"],
      ["course-1", "u2"],
      ["course-2", "u1"],
    ]);
  });
});
