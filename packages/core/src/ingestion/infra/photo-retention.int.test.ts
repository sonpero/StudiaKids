import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { sql } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { freshDb } from "../../../../../tests/support/db.js";
import { addPage } from "../application/add-page.js";
import { confirmCourse } from "../application/confirm-course.js";
import { createCourse } from "../application/create-course.js";
import { fakeJobQueue, sequentialIds, tinyJpeg } from "../application/fakes.js";
import { rejectCourse } from "../application/reject-course.js";
import { removeConfirmedCoursePhotos } from "../application/remove-course-photos.js";
import { LocalFileStore } from "./local-file-store.js";
import { SqliteCourseRepository } from "./sqlite-course-repository.js";

const now = new Date("2026-10-04T10:00:00.000Z");

// docs/securite.md (2026-10-04): no photo left on the volume, nor any row
// pointing at one, once a course is confirmed or rejected.
describe("photos on SQLite and disk", () => {
  const cleanups: (() => void)[] = [];
  afterEach(() => {
    while (cleanups.length) cleanups.pop()?.();
  });

  async function readyCourse() {
    const { db, cleanup } = freshDb();
    const volume = mkdtempSync(path.join(tmpdir(), "studiakids-volume-"));
    cleanups.push(cleanup, () => rmSync(volume, { recursive: true, force: true }));
    db.run(sql`INSERT INTO accounts (id, username, password_hash, session_version, first_name, grade, created_at)
               VALUES ('u1', 'lea', 'x', 1, 'Léa', 'CM1', ${now.toISOString()})`);
    const deps = { repo: new SqliteCourseRepository(db), fileStore: new LocalFileStore(volume), idGenerator: sequentialIds(), jobQueue: fakeJobQueue() };
    await createCourse(deps, "u1", "CM1", now);
    await addPage(deps, "u1", "course-0", tinyJpeg(1), now);
    await addPage(deps, "u1", "course-0", tinyJpeg(2), now);
    await deps.repo.completeExtraction("u1", "course-0", { markdown: "# A", title: "Le verbe", subject: "french", color: "matiere-francais" }, now);
    const dir = path.join(volume, "photos", "u1", "course-0");
    expect(readdirSync(dir)).toHaveLength(2);
    return { db, deps, dir };
  }

  it("after confirmation: no photo on the volume, no page row, the text kept", async () => {
    const { db, deps, dir } = await readyCourse();

    await confirmCourse(deps, "u1", "course-0", now);

    expect(existsSync(dir)).toBe(false);
    expect(db.all(sql`SELECT * FROM pages`)).toEqual([]);
    expect(db.all(sql`SELECT course_id FROM extractions`)).toEqual([{ course_id: "course-0" }]);
  });

  it("after rejection: no photo on the volume, no page row", async () => {
    const { db, deps, dir } = await readyCourse();

    await rejectCourse(deps, "u1", "course-0", now);

    expect(existsSync(dir)).toBe(false);
    expect(db.all(sql`SELECT * FROM pages`)).toEqual([]);
  });

  it("the photos a confirmed course still has are measured on disk, then removed", async () => {
    const { db, deps, dir } = await readyCourse();
    db.run(sql`UPDATE courses SET confirmed = 1`);
    const bytes = tinyJpeg(1).byteLength + tinyJpeg(2).byteLength;

    expect(await removeConfirmedCoursePhotos(deps, "u1", "course-0", { dryRun: true })).toEqual({ files: 2, bytes });
    expect(readdirSync(dir)).toHaveLength(2);
    expect(await removeConfirmedCoursePhotos(deps, "u1", "course-0", { dryRun: false })).toEqual({ files: 2, bytes });
    expect(existsSync(dir)).toBe(false);
    expect(db.all(sql`SELECT * FROM pages`)).toEqual([]);
  });
});
