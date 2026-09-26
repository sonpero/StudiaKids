import { sql } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { freshDb, type Db } from "../../../../../tests/support/db.js";
import { SqliteCourseRepository } from "../../ingestion/index.js";
import { ok } from "../../shared/index.js";
import { IngestionCourseTexts } from "./ingestion-course-texts.js";

const at = "2026-09-26T10:00:00.000Z";

function seed(db: Db, userId: string, courseId: string, confirmed: boolean): void {
  db.run(sql`INSERT OR IGNORE INTO accounts (id, username, password_hash, session_version, first_name, grade, created_at)
             VALUES (${userId}, ${`user-${userId}`}, 'x', 1, 'Léa', 'CE2', ${at})`);
  db.run(sql`INSERT INTO courses (id, user_id, title, grade, color, extraction_status, confirmed, created_at, last_accessed_at)
             VALUES (${courseId}, ${userId}, 'Le verbe', 'CE2', 'matiere-francais', 'ready', ${confirmed ? 1 : 0}, ${at}, ${at})`);
  db.run(sql`INSERT INTO extractions (course_id, markdown, extracted_at) VALUES (${courseId}, '# Le verbe', ${at})`);
}

// The generator reads a course's text through ingestion's index only.
describe("IngestionCourseTexts", () => {
  let cleanup: (() => void) | undefined;
  afterEach(() => cleanup?.());

  it("gives a confirmed course's Markdown and grade, refuses an unconfirmed one, and hides another account's", async () => {
    const fresh = freshDb();
    cleanup = fresh.cleanup;
    seed(fresh.db, "u1", "c1", true);
    seed(fresh.db, "u1", "c2", false);
    const texts = new IngestionCourseTexts(new SqliteCourseRepository(fresh.db));

    expect(await texts.read("u1", "c1")).toEqual(ok({ markdown: "# Le verbe", grade: "CE2" }));
    expect(await texts.read("u1", "c2")).toEqual({ ok: false, error: "not-ready" });
    expect(await texts.read("u2", "c1")).toEqual({ ok: false, error: "not-found" });
  });
});
