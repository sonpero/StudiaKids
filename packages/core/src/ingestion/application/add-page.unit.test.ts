import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { MAX_PAGE_BYTES } from "../domain/photo.js";
import { addPage } from "./add-page.js";
import { createCourse } from "./create-course.js";
import { fakeCourseRepository, fakeFileStore, sequentialIds, tinyJpeg } from "./fakes.js";

const now = new Date("2026-09-25T10:00:00.000Z");

async function setup() {
  const repo = fakeCourseRepository();
  const fileStore = fakeFileStore();
  const deps = { repo, fileStore, idGenerator: sequentialIds() };
  await createCourse(deps, "u1", "CM1", now);
  return { repo, fileStore, deps };
}

describe("addPage", () => {
  it("stores the photo without its metadata, hashes what is stored, and numbers pages contiguously", async () => {
    const { repo, fileStore, deps } = await setup();

    const first = await addPage(deps, "u1", "course-0", tinyJpeg(1, { withGps: true }), now);
    const second = await addPage(deps, "u1", "course-0", tinyJpeg(2), now);

    expect(first.ok && first.value.index).toBe(0);
    expect(second.ok && second.value.index).toBe(1);
    const stored = fileStore.files.get("photos/u1/course-0/0.jpg")!;
    expect(stored).toEqual(tinyJpeg(1));
    expect(Buffer.from(stored).toString("latin1")).not.toContain("GPS");
    expect(repo.pages[0]).toMatchObject({
      courseId: "course-0",
      index: 0,
      sha256: createHash("sha256").update(stored).digest("hex"),
      storedPath: "photos/u1/course-0/0.jpg",
      sizeBytes: stored.length,
      legible: null,
      isCoursePage: null,
      unusableReason: null,
    });
  });

  it("refuses the same photo twice in one course, whatever metadata it carried", async () => {
    const { deps } = await setup();
    await addPage(deps, "u1", "course-0", tinyJpeg(1, { withGps: true }), now);

    expect(await addPage(deps, "u1", "course-0", tinyJpeg(1), now)).toEqual({ ok: false, error: "duplicate" });
  });

  it("refuses a sixth page and stores nothing for it", async () => {
    const { fileStore, deps } = await setup();
    for (let seed = 1; seed <= 5; seed++) await addPage(deps, "u1", "course-0", tinyJpeg(seed), now);

    expect(await addPage(deps, "u1", "course-0", tinyJpeg(6), now)).toEqual({ ok: false, error: "too-many-pages" });
    expect(fileStore.files.size).toBe(5);
  });

  it("refuses anything that is not really a JPEG, and a malformed one", async () => {
    const { fileStore, deps } = await setup();
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
    const brokenJpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe1, 0x40, 0x00]);

    expect(await addPage(deps, "u1", "course-0", png, now)).toEqual({ ok: false, error: "unsupported" });
    expect(await addPage(deps, "u1", "course-0", brokenJpeg, now)).toEqual({ ok: false, error: "unsupported" });
    expect(fileStore.files.size).toBe(0);
  });

  it("refuses a JPEG over the size limit", async () => {
    const { deps } = await setup();
    const huge = new Uint8Array(MAX_PAGE_BYTES + 1);
    huge.set([0xff, 0xd8, 0xff]);

    expect(await addPage(deps, "u1", "course-0", huge, now)).toEqual({ ok: false, error: "too-large" });
  });

  it("treats another account's course exactly like a course that does not exist", async () => {
    const { fileStore, deps } = await setup();

    expect(await addPage(deps, "u2", "course-0", tinyJpeg(1), now)).toEqual({ ok: false, error: "not-found" });
    expect(await addPage(deps, "u1", "no-such-course", tinyJpeg(1), now)).toEqual({ ok: false, error: "not-found" });
    expect(fileStore.files.size).toBe(0);
  });

  it("refuses new pages once the photos are being read", async () => {
    const { repo, deps } = await setup();
    await repo.setExtractionStatus("u1", "course-0", "running");

    expect(await addPage(deps, "u1", "course-0", tinyJpeg(1), now)).toEqual({ ok: false, error: "locked" });
  });
});
