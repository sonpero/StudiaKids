import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { sql } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { freshDb } from "../../../../../tests/support/db.js";
import { ok } from "../../shared/index.js";
import { addPage } from "../application/add-page.js";
import { createCourse } from "../application/create-course.js";
import { deleteCourse } from "../application/delete-course.js";
import { fakeJobQueue, legiblePage, scriptedCourseNamer, scriptedPhotoExtractor, sequentialIds, tinyJpeg } from "../application/fakes.js";
import { handleExtractionJob } from "../application/handle-extraction-job.js";
import { LocalFileStore } from "./local-file-store.js";
import { SqliteCourseRepository } from "./sqlite-course-repository.js";

const now = new Date("2026-09-25T10:00:00.000Z");

// The real repository and the real filesystem together: what the unit
// tests with fakes cannot prove.
describe("ingestion on SQLite and disk", () => {
  const cleanups: (() => void)[] = [];
  afterEach(() => {
    while (cleanups.length) cleanups.pop()?.();
  });

  function setup() {
    const { db, cleanup } = freshDb();
    const volume = mkdtempSync(path.join(tmpdir(), "studiakids-volume-"));
    cleanups.push(cleanup, () => rmSync(volume, { recursive: true, force: true }));
    db.run(sql`INSERT INTO accounts (id, username, password_hash, session_version, first_name, grade, created_at)
               VALUES ('u1', 'lea', 'x', 1, 'Léa', 'CM1', ${now.toISOString()})`);
    const deps = { repo: new SqliteCourseRepository(db), fileStore: new LocalFileStore(volume), idGenerator: sequentialIds(), jobQueue: fakeJobQueue() };
    return { db, volume, deps };
  }

  it("addPage writes the photo file and its row", async () => {
    const { db, volume, deps } = setup();
    await createCourse(deps, "u1", "CM1", now);

    const added = await addPage(deps, "u1", "course-0", tinyJpeg(1, { withGps: true }), now);

    if (!added.ok) throw new Error(added.error);
    expect(existsSync(path.join(volume, added.value.storedPath))).toBe(true);
    expect(db.all(sql`SELECT course_id, page_index FROM pages`)).toEqual([{ course_id: "course-0", page_index: 0 }]);
  });

  // Acceptance (docs/jalons.md, M2): deleting a course deletes its photo
  // files on disk, not only its rows.
  it("deleting a course deletes its photo files on disk, not only its rows", async () => {
    const { db, volume, deps } = setup();
    await createCourse(deps, "u1", "CM1", now);
    const added = await addPage(deps, "u1", "course-0", tinyJpeg(1), now);
    if (!added.ok) throw new Error(added.error);
    const file = path.join(volume, added.value.storedPath);
    expect(existsSync(file)).toBe(true);

    expect(await deleteCourse(deps, "u1", "course-0")).toEqual(ok(undefined));

    expect(existsSync(file)).toBe(false);
    expect(existsSync(path.dirname(file))).toBe(false);
    expect(db.all(sql`SELECT * FROM courses`)).toEqual([]);
    expect(db.all(sql`SELECT * FROM pages`)).toEqual([]);
  });

  it("creating a new course deletes the previous unconfirmed one's files too", async () => {
    const { volume, deps } = setup();
    await createCourse(deps, "u1", "CM1", now);
    const added = await addPage(deps, "u1", "course-0", tinyJpeg(1), now);
    if (!added.ok) throw new Error(added.error);

    await createCourse(deps, "u1", "CM1", now);

    expect(existsSync(path.join(volume, added.value.storedPath))).toBe(false);
  });

  // Acceptance (docs/jalons.md, M2): running the extraction handler twice
  // leaves exactly one extraction.
  it("running the extraction handler twice leaves exactly one extraction", async () => {
    const { db, deps } = setup();
    await createCourse(deps, "u1", "CM1", now);
    await addPage(deps, "u1", "course-0", tinyJpeg(1), now);
    const ctx = { jobId: "job-0", userId: "u1", attempt: 1, now };
    const run = () =>
      handleExtractionJob(
        { ...deps, extractor: scriptedPhotoExtractor([legiblePage("# Le verbe\n\n## 1. Définition")]), namer: scriptedCourseNamer(ok({ title: "Le verbe", subject: "french" as const })) },
        { courseId: "course-0" },
        ctx,
      );

    await run();
    // A crash after the writes but before the job was marked done: the
    // stored status is reset so the second run really re-extracts.
    await deps.repo.setExtractionStatus("u1", "course-0", "running");
    await run();

    expect(db.all(sql`SELECT course_id FROM extractions`)).toEqual([{ course_id: "course-0" }]);
    expect(db.all(sql`SELECT extraction_status, title FROM courses`)).toEqual([{ extraction_status: "ready", title: "Le verbe" }]);
  });
});
