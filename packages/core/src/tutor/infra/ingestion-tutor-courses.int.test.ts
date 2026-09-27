import { sql } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { freshDb, type Db } from "../../../../../tests/support/db.js";
import { SqliteCourseRepository } from "../../ingestion/index.js";
import { ok } from "../../shared/index.js";
import { IngestionTutorCourses } from "./ingestion-tutor-courses.js";

const at = "2026-09-27T10:00:00.000Z";

function seed(db: Db, userId: string, courseId: string, confirmed: boolean, subject: string | null): void {
  db.run(sql`INSERT OR IGNORE INTO accounts (id, username, password_hash, session_version, first_name, grade, created_at)
             VALUES (${userId}, ${`user-${userId}`}, 'x', 1, 'Léa', 'CE2', ${at})`);
  db.run(sql`INSERT INTO courses (id, user_id, title, subject, grade, color, extraction_status, confirmed, created_at, last_accessed_at)
             VALUES (${courseId}, ${userId}, 'Le verbe', ${subject}, 'CE2', 'matiere-francais', 'ready', ${confirmed ? 1 : 0}, ${at}, ${at})`);
  db.run(sql`INSERT INTO extractions (course_id, markdown, extracted_at) VALUES (${courseId}, '# Le verbe', ${at})`);
}

// The tutor reads a course through ingestion's index only.
describe("IngestionTutorCourses", () => {
  let cleanup: (() => void) | undefined;
  afterEach(() => cleanup?.());

  it("gives a confirmed course's title, subject (in French, for the classifier), grade and text; refuses an unconfirmed one; hides another account's", async () => {
    const fresh = freshDb();
    cleanup = fresh.cleanup;
    seed(fresh.db, "u1", "c1", true, "french");
    seed(fresh.db, "u1", "c2", false, null);
    seed(fresh.db, "u1", "c3", true, null);
    const courses = new IngestionTutorCourses(new SqliteCourseRepository(fresh.db));

    expect(await courses.read("u1", "c1")).toEqual(ok({ title: "Le verbe", subject: "français", grade: "CE2", markdown: "# Le verbe" }));
    expect(await courses.read("u1", "c3")).toEqual(ok({ title: "Le verbe", subject: "non précisée", grade: "CE2", markdown: "# Le verbe" }));
    expect(await courses.read("u1", "c2")).toEqual({ ok: false, error: "not-ready" });
    expect(await courses.read("u2", "c1")).toEqual({ ok: false, error: "not-found" });
  });
});
