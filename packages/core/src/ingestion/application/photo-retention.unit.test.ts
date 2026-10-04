import { describe, expect, it } from "vitest";
import { addPage } from "./add-page.js";
import { confirmCourse } from "./confirm-course.js";
import { createCourse } from "./create-course.js";
import { fakeCourseRepository, fakeFileStore, fakeJobQueue, sequentialIds, tinyJpeg } from "./fakes.js";
import { ABANDONED_COURSE_MAX_AGE_DAYS, purgeAbandonedCourse } from "./purge-abandoned-course.js";
import { readPageFile } from "./read-page-file.js";
import { rejectCourse } from "./reject-course.js";
import { removeConfirmedCoursePhotos } from "./remove-course-photos.js";

// docs/securite.md, "Données conservées" (decided on 2026-10-04): a
// course's photos only serve its extraction. Kept while the course is not
// confirmed; removed, files and rows, once it is confirmed or rejected.
const day = (n: number) => new Date(Date.UTC(2026, 9, 4 + n, 10));

function setup() {
  const repo = fakeCourseRepository();
  const fileStore = fakeFileStore();
  const failures: { courseId: string; message: string }[] = [];
  const deps = { repo, fileStore, jobQueue: fakeJobQueue(), idGenerator: sequentialIds(), onPhotoRemovalFailure: (failure: { courseId: string; message: string }) => failures.push(failure) };
  return { repo, fileStore, failures, deps };
}

async function readyCourse(deps: ReturnType<typeof setup>["deps"], userId: string, at: Date, pages = 2) {
  const created = await createCourse(deps, userId, "CE1", at);
  if (!created.ok) throw new Error("create failed");
  for (let i = 0; i < pages; i++) await addPage(deps, userId, created.value.id, tinyJpeg(at.getUTCDate() * 10 + i), at);
  await deps.repo.completeExtraction(userId, created.value.id, { markdown: "# Le verbe secret", title: "Le verbe", subject: "french", color: "matiere-francais" }, at);
  return created.value.id;
}

describe("photos at confirmation", () => {
  it("confirming removes the course's photo files and their rows", async () => {
    const { repo, fileStore, deps } = setup();
    const id = await readyCourse(deps, "u1", day(0));
    expect(fileStore.files.size).toBe(2);

    expect(await confirmCourse(deps, "u1", id, day(0))).toEqual({ ok: true, value: undefined });

    expect(fileStore.files.size).toBe(0);
    expect(repo.pages).toEqual([]);
    expect(repo.courses[0]?.confirmed).toBe(true);
    expect(repo.extractions.map((e) => e.markdown)).toEqual(["# Le verbe secret"]);
  });

  it("a file that cannot be removed never fails the confirmation: reported, without the course's content", async () => {
    const { repo, fileStore, failures, deps } = setup();
    const id = await readyCourse(deps, "u1", day(0));
    fileStore.deleteCourse = () => Promise.reject(new Error("EACCES: permission denied"));

    expect(await confirmCourse(deps, "u1", id, day(0))).toEqual({ ok: true, value: undefined });

    expect(repo.courses[0]?.confirmed).toBe(true);
    expect(failures).toEqual([{ courseId: id, message: "EACCES: permission denied" }]);
    expect(JSON.stringify(failures)).not.toContain("verbe");
    // The rows still say where the files are, for the purge to find them.
    expect(repo.pages).toHaveLength(2);
  });

  it("another account's photos are never touched", async () => {
    const { fileStore, deps } = setup();
    const theirs = await readyCourse(deps, "u2", day(0));

    expect(await confirmCourse(deps, "u1", theirs, day(0))).toEqual({ ok: false, error: "not-found" });
    expect(fileStore.files.size).toBe(2);
  });
});

describe("photos at rejection", () => {
  it("rejecting removes the course's photo files and their rows", async () => {
    const { repo, fileStore, deps } = setup();
    const id = await readyCourse(deps, "u1", day(0));

    await rejectCourse(deps, "u1", id, day(0));

    expect(fileStore.files.size).toBe(0);
    expect(repo.pages).toEqual([]);
  });
});

describe("readPageFile", () => {
  it("serves a photo only while its course is not confirmed", async () => {
    const { repo, deps } = setup();
    const id = await readyCourse(deps, "u1", day(0));
    expect((await readPageFile(deps, "u1", id, 0)).ok).toBe(true);

    // Even if a file could not be removed at confirmation.
    await repo.confirmCourse("u1", id);

    expect(await readPageFile(deps, "u1", id, 0)).toEqual({ ok: false, error: "not-found" });
  });
});

describe("purgeAbandonedCourse", () => {
  it(`an unconfirmed course older than ${String(ABANDONED_COURSE_MAX_AGE_DAYS)} days is deleted with its photos`, async () => {
    const { repo, fileStore, deps } = setup();
    await readyCourse(deps, "u1", day(0));

    expect(await purgeAbandonedCourse(deps, "u1", day(ABANDONED_COURSE_MAX_AGE_DAYS - 1))).toBe(false);
    expect(fileStore.files.size).toBe(2);

    expect(await purgeAbandonedCourse(deps, "u1", day(ABANDONED_COURSE_MAX_AGE_DAYS))).toBe(true);
    expect(repo.courses).toEqual([]);
    expect(fileStore.files.size).toBe(0);
  });

  it("a confirmed course, or another account's, is never purged", async () => {
    const { repo, deps } = setup();
    const id = await readyCourse(deps, "u1", day(0));
    await confirmCourse(deps, "u1", id, day(0));
    await readyCourse(deps, "u2", day(0));

    expect(await purgeAbandonedCourse(deps, "u1", day(60))).toBe(false);
    expect(repo.courses).toHaveLength(2);
  });
});

describe("removeConfirmedCoursePhotos (photos kept before 2026-10-04)", () => {
  it("measures, then removes the photos of a confirmed course; dry run removes nothing", async () => {
    const { repo, fileStore, deps } = setup();
    const id = await readyCourse(deps, "u1", day(0));
    await repo.confirmCourse("u1", id);
    const bytes = [...fileStore.files.values()].reduce((sum, file) => sum + file.byteLength, 0);

    expect(await removeConfirmedCoursePhotos(deps, "u1", id, { dryRun: true })).toEqual({ files: 2, bytes });
    expect(fileStore.files.size).toBe(2);

    expect(await removeConfirmedCoursePhotos(deps, "u1", id, { dryRun: false })).toEqual({ files: 2, bytes });
    expect(fileStore.files.size).toBe(0);
    expect(repo.pages).toEqual([]);
  });

  it("an unconfirmed course keeps its photos: its extraction may still need them", async () => {
    const { fileStore, deps } = setup();
    const id = await readyCourse(deps, "u1", day(0));

    expect(await removeConfirmedCoursePhotos(deps, "u1", id, { dryRun: false })).toEqual({ files: 0, bytes: 0 });
    expect(fileStore.files.size).toBe(2);
  });
});
