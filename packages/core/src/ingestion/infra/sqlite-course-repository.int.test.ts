import { sql } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { freshDb, type Db } from "../../../../../tests/support/db.js";
import type { Course, Page } from "../domain/types.js";
import { SqliteCourseRepository } from "./sqlite-course-repository.js";

const t = (minutes: number) => new Date(Date.UTC(2026, 8, 25, 10, minutes));

function seedAccount(db: Db, id: string): void {
  db.run(sql`INSERT INTO accounts (id, username, password_hash, session_version, first_name, grade, created_at)
             VALUES (${id}, ${`user-${id}`}, 'x', 1, 'Test', 'CE2', ${t(0).toISOString()})`);
}

function course(id: string, userId: string, overrides: Partial<Course> = {}): Course {
  return {
    id,
    userId,
    title: "",
    subject: null,
    grade: "CE2",
    color: "",
    extractionStatus: "pending",
    confirmed: false,
    pageCount: 0,
    createdAt: t(0).toISOString(),
    lastAccessedAt: t(0).toISOString(),
    ...overrides,
  };
}

function page(courseId: string, index: number, sha256 = `sha-${courseId}-${String(index)}`): Page {
  return { courseId, index, sha256, storedPath: `photos/u/${courseId}/${String(index)}.jpg`, sizeBytes: 100 + index, legible: null, isCoursePage: null, unusableReason: null };
}

// drizzle wraps raw-SQL failures; SQLite's own message is on `cause`.
function sqliteError(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    return String((error as Error).cause ?? error);
  }
  return "no error";
}

describe("SqliteCourseRepository", () => {
  let cleanup: (() => void) | undefined;
  afterEach(() => cleanup?.());

  function setup() {
    const fresh = freshDb();
    cleanup = fresh.cleanup;
    seedAccount(fresh.db, "u1");
    seedAccount(fresh.db, "u2");
    return { db: fresh.db, repo: new SqliteCourseRepository(fresh.db) };
  }

  it("round-trips a course, with its page count, and never shows it to another account", async () => {
    const { repo } = setup();
    await repo.insertCourse(course("c1", "u1"));
    await repo.addPage("u1", page("c1", 0));
    await repo.addPage("u1", page("c1", 1));

    expect(await repo.findCourse("u1", "c1")).toEqual(course("c1", "u1", { pageCount: 2 }));
    expect(await repo.findCourse("u2", "c1")).toBeNull();
    expect(await repo.findCourse("u1", "nope")).toBeNull();
  });

  it("finds the account's unconfirmed course, and lists confirmed ones most recently opened first", async () => {
    const { repo } = setup();
    await repo.insertCourse(course("old", "u1", { confirmed: true, extractionStatus: "ready", lastAccessedAt: t(1).toISOString() }));
    await repo.insertCourse(course("new", "u1", { confirmed: true, extractionStatus: "ready", lastAccessedAt: t(5).toISOString() }));
    await repo.insertCourse(course("pending", "u1"));
    await repo.insertCourse(course("theirs", "u2", { confirmed: true, extractionStatus: "ready" }));

    expect((await repo.listConfirmedCourses("u1")).map((c) => c.id)).toEqual(["new", "old"]);
    expect((await repo.findUnconfirmedCourse("u1"))?.id).toBe("pending");
    expect(await repo.findUnconfirmedCourse("u2")).toBeNull();
  });

  it("lists pages by index, refuses the same photo twice in a course but allows it in another", async () => {
    const { repo } = setup();
    await repo.insertCourse(course("c1", "u1"));
    await repo.insertCourse(course("c2", "u1"));
    await repo.addPage("u1", page("c1", 1, "same"));
    await repo.addPage("u1", page("c1", 0));

    await expect(repo.addPage("u1", page("c1", 2, "same"))).rejects.toThrow(/UNIQUE/);
    await repo.addPage("u1", page("c2", 0, "same"));
    expect((await repo.listPages("u1", "c1")).map((p) => p.index)).toEqual([0, 1]);
    expect(await repo.listPages("u2", "c1")).toEqual([]);
  });

  it("refuses a page on another account's course", async () => {
    const { repo } = setup();
    await repo.insertCourse(course("c1", "u1"));

    await expect(repo.addPage("u2", page("c1", 0))).rejects.toThrow();
    expect(await repo.listPages("u1", "c1")).toEqual([]);
  });

  it("records and resets page results, only for the owner", async () => {
    const { repo } = setup();
    await repo.insertCourse(course("c1", "u1"));
    await repo.addPage("u1", page("c1", 0));

    await repo.recordPageResult("u2", "c1", 0, { legible: false, isCoursePage: null, unusableReason: "x" });
    expect((await repo.listPages("u1", "c1"))[0]).toMatchObject({ legible: null });

    await repo.recordPageResult("u1", "c1", 0, { legible: true, isCoursePage: false, unusableReason: "un chat" });
    expect((await repo.listPages("u1", "c1"))[0]).toMatchObject({ legible: true, isCoursePage: false, unusableReason: "un chat" });

    await repo.resetPageResults("u1", "c1");
    expect((await repo.listPages("u1", "c1"))[0]).toMatchObject({ legible: null, isCoursePage: null, unusableReason: null });
  });

  it("changes status, confirms and touches only the owner's course", async () => {
    const { repo } = setup();
    await repo.insertCourse(course("c1", "u1"));

    await repo.setExtractionStatus("u2", "c1", "running");
    await repo.confirmCourse("u2", "c1");
    await repo.touchCourse("u2", "c1", t(9));
    expect(await repo.findCourse("u1", "c1")).toMatchObject({ extractionStatus: "pending", confirmed: false, lastAccessedAt: t(0).toISOString() });

    await repo.setExtractionStatus("u1", "c1", "running");
    await repo.confirmCourse("u1", "c1");
    await repo.touchCourse("u1", "c1", t(9));
    expect(await repo.findCourse("u1", "c1")).toMatchObject({ extractionStatus: "running", confirmed: true, lastAccessedAt: t(9).toISOString() });
  });

  it("completeExtraction replaces any extraction and sets title, subject, color and ready together", async () => {
    const { repo } = setup();
    await repo.insertCourse(course("c1", "u1"));
    const result = { markdown: "# A", title: "Le verbe", subject: "french" as const, color: "matiere-francais" };

    await repo.completeExtraction("u1", "c1", result, t(1));
    await repo.completeExtraction("u1", "c1", { ...result, markdown: "# B" }, t(2));

    expect(await repo.getExtraction("u1", "c1")).toEqual({ courseId: "c1", markdown: "# B", extractedAt: t(2).toISOString() });
    expect(await repo.findCourse("u1", "c1")).toMatchObject({ title: "Le verbe", subject: "french", color: "matiere-francais", extractionStatus: "ready" });
    expect(await repo.getExtraction("u2", "c1")).toBeNull();
  });

  it("completeExtraction does nothing on another account's course", async () => {
    const { repo } = setup();
    await repo.insertCourse(course("c1", "u1"));

    await repo.completeExtraction("u2", "c1", { markdown: "# A", title: "T", subject: "maths", color: "matiere-maths" }, t(1));

    expect(await repo.getExtraction("u1", "c1")).toBeNull();
    expect((await repo.findCourse("u1", "c1"))?.extractionStatus).toBe("pending");
  });

  it("deleteCourse removes the course with its pages and extraction, only for the owner", async () => {
    const { db, repo } = setup();
    await repo.insertCourse(course("c1", "u1"));
    await repo.addPage("u1", page("c1", 0));
    await repo.completeExtraction("u1", "c1", { markdown: "# A", title: "T", subject: "maths", color: "matiere-maths" }, t(1));

    expect(await repo.deleteCourse("u2", "c1")).toBe(false);
    expect(await repo.findCourse("u1", "c1")).not.toBeNull();

    expect(await repo.deleteCourse("u1", "c1")).toBe(true);
    expect(db.all(sql`SELECT * FROM pages`)).toEqual([]);
    expect(db.all(sql`SELECT * FROM extractions`)).toEqual([]);
    expect(await repo.deleteCourse("u1", "c1")).toBe(false);
  });

  // Constraints hand-added to, or declared in, the migration (docs/donnees.md).
  it("deleting an account deletes its courses, pages and extractions (ON DELETE CASCADE)", async () => {
    const { db, repo } = setup();
    await repo.insertCourse(course("c1", "u1"));
    await repo.addPage("u1", page("c1", 0));
    await repo.completeExtraction("u1", "c1", { markdown: "# A", title: "T", subject: "maths", color: "matiere-maths" }, t(1));
    await repo.insertCourse(course("c2", "u2"));

    db.run(sql`DELETE FROM accounts WHERE id = 'u1'`);

    expect(db.all(sql`SELECT id FROM courses`)).toEqual([{ id: "c2" }]);
    expect(db.all(sql`SELECT * FROM pages`)).toEqual([]);
    expect(db.all(sql`SELECT * FROM extractions`)).toEqual([]);
  });

  it("rejects a course for an account that does not exist", async () => {
    const { repo } = setup();

    await expect(repo.insertCourse(course("c1", "ghost"))).rejects.toThrow(/FOREIGN KEY/);
  });

  it("rejects values outside the closed lists at the database level", () => {
    const { db } = setup();
    const insert = (status: string, subject: string | null, grade: string) =>
      sqliteError(() =>
        db.run(sql`INSERT INTO courses (id, user_id, grade, extraction_status, subject, created_at, last_accessed_at)
                   VALUES (${`c-${status}-${String(subject)}-${grade}`}, 'u1', ${grade}, ${status}, ${subject}, 'x', 'x')`),
      );

    expect(insert("failed", null, "CE2")).toMatch(/CHECK constraint/);
    expect(insert("pending", "mathematics", "CE2")).toMatch(/CHECK constraint/);
    expect(insert("pending", null, "CE7")).toMatch(/CHECK constraint/);
    expect(insert("not_a_course_page", "other", "6e")).toBe("no error");
  });

  it("indexes courses by account and last access, descending", () => {
    const { db } = setup();

    const columns = db.all<{ name: string | null; desc: number }>(sql`PRAGMA index_xinfo('idx_courses_user_last_accessed')`);

    expect(columns.filter((col) => col.name !== null).map((col) => [col.name, col.desc])).toEqual([
      ["user_id", 0],
      ["last_accessed_at", 1],
    ]);
  });
});
