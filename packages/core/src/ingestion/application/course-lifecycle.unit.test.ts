import { describe, expect, it } from "vitest";
import { addPage } from "./add-page.js";
import { confirmCourse } from "./confirm-course.js";
import { createCourse } from "./create-course.js";
import { deleteCourse } from "./delete-course.js";
import { fakeCourseRepository, fakeFileStore, fakeJobQueue, sequentialIds, tinyJpeg } from "./fakes.js";
import { getUnconfirmedCourse } from "./get-unconfirmed-course.js";
import { listConfirmedCourses } from "./list-confirmed-courses.js";
import { readPageFile } from "./read-page-file.js";
import { recordAccess } from "./record-access.js";
import { rejectCourse } from "./reject-course.js";

const t = (minutes: number) => new Date(Date.UTC(2026, 8, 25, 10, minutes));

function setup() {
  const repo = fakeCourseRepository();
  const fileStore = fakeFileStore();
  const jobQueue = fakeJobQueue();
  const deps = { repo, fileStore, jobQueue, idGenerator: sequentialIds() };
  return { repo, fileStore, jobQueue, deps };
}

async function readyCourse(deps: ReturnType<typeof setup>["deps"], userId: string, at: Date) {
  const created = await createCourse(deps, userId, "CE1", at);
  if (!created.ok) throw new Error("create failed");
  await addPage(deps, userId, created.value.id, tinyJpeg(at.getUTCMinutes() + 1), at);
  await deps.repo.completeExtraction(userId, created.value.id, { markdown: "# A", title: "Le verbe", subject: "french", color: "matiere-francais" }, at);
  return created.value.id;
}

describe("confirmCourse", () => {
  it("confirms a ready course (\"Oui, c'est ça !\")", async () => {
    const { repo, deps } = setup();
    const id = await readyCourse(deps, "u1", t(0));

    expect(await confirmCourse(deps, "u1", id, t(1))).toEqual({ ok: true, value: undefined });
    expect(repo.courses[0]?.confirmed).toBe(true);
  });

  it("refuses a course that is not ready: nothing is ever shown as settled before the job is done", async () => {
    const { deps } = setup();
    const created = await createCourse(deps, "u1", "CE1", t(0));
    if (!created.ok) throw new Error();

    expect(await confirmCourse(deps, "u1", created.value.id, t(1))).toEqual({ ok: false, error: "not-ready" });
    expect(await confirmCourse(deps, "u2", created.value.id, t(1))).toEqual({ ok: false, error: "not-found" });
  });
});

describe("rejectCourse", () => {
  it("deletes an unconfirmed course entirely, photo files included (\"Je reprends la photo\")", async () => {
    const { repo, fileStore, deps } = setup();
    const id = await readyCourse(deps, "u1", t(0));

    expect(await rejectCourse(deps, "u1", id, t(1))).toEqual({ ok: true, value: undefined });
    expect(repo.courses).toEqual([]);
    expect(fileStore.files.size).toBe(0);
  });

  it("never deletes a confirmed course: that is what DELETE is for", async () => {
    const { repo, deps } = setup();
    const id = await readyCourse(deps, "u1", t(0));
    await confirmCourse(deps, "u1", id, t(1));

    expect(await rejectCourse(deps, "u1", id, t(2))).toEqual({ ok: false, error: "already-confirmed" });
    expect(repo.courses).toHaveLength(1);
  });
});

describe("deleteCourse", () => {
  it("removes the photo files and the rows in the same call", async () => {
    const { repo, fileStore, deps } = setup();
    const id = await readyCourse(deps, "u1", t(0));
    await confirmCourse(deps, "u1", id, t(1));

    expect(await deleteCourse(deps, "u1", id)).toEqual({ ok: true, value: undefined });
    expect(fileStore.files.size).toBe(0);
    expect(repo.courses).toEqual([]);
    expect(repo.pages).toEqual([]);
    expect(repo.extractions).toEqual([]);
  });

  // Files go first: if something breaks midway, a course left without its
  // photos is visible and can be deleted again, whereas photos left without
  // their course would outlive it silently (docs/securite.md).
  it("deletes the files before the rows", async () => {
    const { fileStore, deps } = setup();
    const id = await readyCourse(deps, "u1", t(0));
    const order: string[] = [];
    const repo = { ...deps.repo, deleteCourse: (u: string, c: string) => (order.push("rows"), deps.repo.deleteCourse(u, c)) };
    const files = { ...fileStore, deleteCourse: (u: string, c: string) => (order.push("files"), fileStore.deleteCourse(u, c)) };

    await deleteCourse({ repo, fileStore: files }, "u1", id);

    expect(order).toEqual(["files", "rows"]);
  });

  it("never touches another account's course", async () => {
    const { repo, fileStore, deps } = setup();
    const id = await readyCourse(deps, "u1", t(0));

    expect(await deleteCourse(deps, "u2", id)).toEqual({ ok: false, error: "not-found" });
    expect(repo.courses).toHaveLength(1);
    expect(fileStore.files.size).toBe(1);
  });
});

describe("listConfirmedCourses, getUnconfirmedCourse, recordAccess", () => {
  it("lists only this account's confirmed courses, most recently opened first", async () => {
    const { deps } = setup();
    const older = await readyCourse(deps, "u1", t(0));
    await confirmCourse(deps, "u1", older, t(0));
    const newer = await readyCourse(deps, "u1", t(1));
    await confirmCourse(deps, "u1", newer, t(1));
    await readyCourse(deps, "u2", t(2)).then((id) => confirmCourse(deps, "u2", id, t(2)));
    await createCourse(deps, "u1", "CE1", t(3));

    expect((await listConfirmedCourses(deps, "u1")).map((c) => c.id)).toEqual([newer, older]);
    await recordAccess(deps, "u1", older, t(10));
    expect((await listConfirmedCourses(deps, "u1")).map((c) => c.id)).toEqual([older, newer]);
  });

  it("recordAccess refuses another account's course", async () => {
    const { deps } = setup();
    const id = await readyCourse(deps, "u1", t(0));

    expect(await recordAccess(deps, "u2", id, t(1))).toEqual({ ok: false, error: "not-found" });
  });

  it("returns the one unconfirmed course, with its displayed status, or null", async () => {
    const { deps } = setup();
    expect(await getUnconfirmedCourse(deps, "u1")).toBeNull();

    const id = await readyCourse(deps, "u1", t(0));

    expect(await getUnconfirmedCourse(deps, "u1")).toMatchObject({ id, extractionStatus: "ready", pageCount: 1 });
    expect(await getUnconfirmedCourse(deps, "u2")).toBeNull();
  });
});

describe("readPageFile", () => {
  it("returns the stored photo of one of the account's pages, and nothing for anyone else", async () => {
    const { deps } = setup();
    const id = await readyCourse(deps, "u1", t(0));

    expect(await readPageFile(deps, "u1", id, 0)).toEqual({ ok: true, value: tinyJpeg(1) });
    expect(await readPageFile(deps, "u1", id, 1)).toEqual({ ok: false, error: "not-found" });
    expect(await readPageFile(deps, "u2", id, 0)).toEqual({ ok: false, error: "not-found" });
  });
});
