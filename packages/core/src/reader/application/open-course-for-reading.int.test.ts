import { sql } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { freshDb, type Db } from "../../../../../tests/support/db.js";
import { SqliteCourseRepository } from "../../ingestion/index.js";
import { ok } from "../../shared/index.js";
import { openCourseForReading } from "./open-course-for-reading.js";

const created = new Date("2026-09-26T08:00:00.000Z");
const now = new Date("2026-09-26T10:00:00.000Z");

function seedCourse(db: Db, userId: string, courseId: string, state: { status: string; confirmed: boolean; pages: number[]; markdown: string | null }): void {
  db.run(sql`INSERT OR IGNORE INTO accounts (id, username, password_hash, session_version, first_name, grade, created_at)
             VALUES (${userId}, ${`user-${userId}`}, 'x', 1, 'Léa', 'CE2', ${created.toISOString()})`);
  db.run(sql`INSERT INTO courses (id, user_id, title, grade, color, extraction_status, confirmed, created_at, last_accessed_at)
             VALUES (${courseId}, ${userId}, 'Le verbe', 'CE2', 'matiere-francais', ${state.status}, ${state.confirmed ? 1 : 0}, ${created.toISOString()}, ${created.toISOString()})`);
  for (const index of state.pages) {
    db.run(sql`INSERT INTO pages (course_id, page_index, sha256, stored_path, size_bytes)
               VALUES (${courseId}, ${index}, ${`sha-${courseId}-${String(index)}`}, ${`photos/${userId}/${courseId}/${String(index)}.jpg`}, 100)`);
  }
  if (state.markdown !== null) db.run(sql`INSERT INTO extractions (course_id, markdown, extracted_at) VALUES (${courseId}, ${state.markdown}, ${created.toISOString()})`);
}

const lastAccess = (db: Db, courseId: string) => db.get<{ at: string }>(sql`SELECT last_accessed_at AS at FROM courses WHERE id = ${courseId}`).at;

describe("openCourseForReading", () => {
  let cleanup: (() => void) | undefined;
  afterEach(() => cleanup?.());

  function setup() {
    const fresh = freshDb();
    cleanup = fresh.cleanup;
    return { db: fresh.db, deps: { repo: new SqliteCourseRepository(fresh.db) } };
  }

  it("gives the Markdown, the text to speak and the course's photos in page order, and records the access", async () => {
    const { db, deps } = setup();
    seedCourse(db, "u1", "c1", { status: "ready", confirmed: true, pages: [1, 0, 2], markdown: "# Le verbe\n\n- chanter" });

    expect(await openCourseForReading(deps, "u1", "c1", now)).toEqual(ok({ markdown: "# Le verbe\n\n- chanter", speech: "Le verbe\nchanter", photos: [{ index: 0 }, { index: 1 }, { index: 2 }] }));
    expect(lastAccess(db, "c1")).toBe(now.toISOString());
  });

  it("refuses a course not confirmed yet, or not ready, as not-ready, without recording an access", async () => {
    const { db, deps } = setup();
    seedCourse(db, "u1", "unconfirmed", { status: "ready", confirmed: false, pages: [0], markdown: "# Le verbe" });
    seedCourse(db, "u1", "running", { status: "running", confirmed: false, pages: [0], markdown: null });

    expect(await openCourseForReading(deps, "u1", "unconfirmed", now)).toEqual({ ok: false, error: "not-ready" });
    expect(await openCourseForReading(deps, "u1", "running", now)).toEqual({ ok: false, error: "not-ready" });
    expect(lastAccess(db, "unconfirmed")).toBe(created.toISOString());
  });

  it("answers another account's course exactly like an unknown one", async () => {
    const { db, deps } = setup();
    seedCourse(db, "u2", "theirs", { status: "ready", confirmed: true, pages: [0], markdown: "# Le verbe" });

    expect(await openCourseForReading(deps, "u1", "theirs", now)).toEqual({ ok: false, error: "not-found" });
    expect(await openCourseForReading(deps, "u1", "nope", now)).toEqual({ ok: false, error: "not-found" });
    expect(lastAccess(db, "theirs")).toBe(created.toISOString());
  });
});
