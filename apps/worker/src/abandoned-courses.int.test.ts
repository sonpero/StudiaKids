import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { purgeAbandonedCourses } from "./abandoned-courses.js";
import { openDatabase, type Db } from "./db/connection.js";
import { runMigrations } from "./db/migrate.js";

// docs/securite.md (2026-10-04): an unconfirmed course nobody came back to
// goes after 7 days, photos included, whichever account it belongs to.
const now = new Date("2026-10-11T10:00:00.000Z");

describe("purgeAbandonedCourses", () => {
  let volume: string;
  let db: Db;

  function course(userId: string, id: string, createdAt: string, confirmed: boolean) {
    db.run(sql`INSERT INTO courses (id, user_id, title, grade, color, extraction_status, confirmed, created_at, last_accessed_at)
               VALUES (${id}, ${userId}, '', 'CE2', '', 'pending', ${confirmed ? 1 : 0}, ${createdAt}, ${createdAt})`);
    const dir = path.join(volume, "photos", userId, id);
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "0.jpg"), "jpeg");
    db.run(sql`INSERT INTO pages (course_id, page_index, sha256, stored_path, size_bytes) VALUES (${id}, 0, ${`sha-${id}`}, ${`photos/${userId}/${id}/0.jpg`}, 4)`);
    return dir;
  }

  beforeEach(() => {
    volume = mkdtempSync(path.join(tmpdir(), "studiakids-abandoned-"));
    db = openDatabase(path.join(volume, "test.db"));
    runMigrations(db);
    for (const [id, username] of [["u1", "lea"], ["u2", "tom"]]) {
      db.run(sql`INSERT INTO accounts (id, username, password_hash, session_version, first_name, grade, created_at) VALUES (${id}, ${username}, 'x', 1, 'A', 'CE2', '2026-09-01T00:00:00.000Z')`);
    }
  });
  afterEach(() => rmSync(volume, { recursive: true, force: true }));

  it("deletes every account's unconfirmed course older than 7 days, files included, and keeps the rest", async () => {
    const old = course("u1", "old", "2026-10-04T09:00:00.000Z", false);
    const recent = course("u2", "recent", "2026-10-05T10:00:00.000Z", false);

    expect(await purgeAbandonedCourses({ db, volumeRoot: volume }, now)).toBe(1);

    expect(existsSync(old)).toBe(false);
    expect(existsSync(recent)).toBe(true);
    expect(db.all<{ id: string }>(sql`SELECT id FROM courses`).map((row) => row.id)).toEqual(["recent"]);
  });
});
