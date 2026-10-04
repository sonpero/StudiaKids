import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase, type Db } from "./db/connection.js";
import { runMigrations } from "./db/migrate.js";
import { purgeConfirmedCoursePhotos } from "./photos-purge.js";

// pnpm photos:purge [--dry-run]: the photos of courses confirmed before
// 2026-10-04 go (docs/securite.md); an unconfirmed course keeps its own.
describe("purgeConfirmedCoursePhotos", () => {
  let volume: string;
  let db: Db;

  function course(userId: string, id: string, confirmed: boolean, sizes: number[]) {
    db.run(sql`INSERT INTO courses (id, user_id, title, grade, color, extraction_status, confirmed, created_at, last_accessed_at)
               VALUES (${id}, ${userId}, 'Le verbe', 'CE2', 'matiere-francais', 'ready', ${confirmed ? 1 : 0}, '2026-09-20T00:00:00.000Z', '2026-09-20T00:00:00.000Z')`);
    const dir = path.join(volume, "photos", userId, id);
    mkdirSync(dir, { recursive: true });
    sizes.forEach((size, index) => {
      writeFileSync(path.join(dir, `${String(index)}.jpg`), Buffer.alloc(size));
      db.run(sql`INSERT INTO pages (course_id, page_index, sha256, stored_path, size_bytes) VALUES (${id}, ${index}, ${`sha-${id}-${String(index)}`}, ${`photos/${userId}/${id}/${String(index)}.jpg`}, ${size})`);
    });
    return dir;
  }
  const pageRows = (courseId: string) => db.all(sql`SELECT * FROM pages WHERE course_id = ${courseId}`).length;

  beforeEach(() => {
    volume = mkdtempSync(path.join(tmpdir(), "studiakids-photos-purge-"));
    db = openDatabase(path.join(volume, "test.db"));
    runMigrations(db);
    for (const [id, username] of [["u1", "lea"], ["u2", "tom"]]) {
      db.run(sql`INSERT INTO accounts (id, username, password_hash, session_version, first_name, grade, created_at) VALUES (${id}, ${username}, 'x', 1, 'A', 'CE2', '2026-09-01T00:00:00.000Z')`);
    }
  });
  afterEach(() => rmSync(volume, { recursive: true, force: true }));

  it("--dry-run counts the files and the bytes to free, and removes nothing", async () => {
    const a = course("u1", "a", true, [1000, 2000]);
    course("u2", "b", true, [500]);
    course("u2", "pending", false, [700]);

    expect(await purgeConfirmedCoursePhotos({ db, volumeRoot: volume }, { dryRun: true })).toEqual({ dryRun: true, courses: 2, files: 3, bytes: 3500 });
    expect(existsSync(a)).toBe(true);
    expect(pageRows("a")).toBe(2);
  });

  it("removes the confirmed courses' photos, files and rows, every account, and keeps an unconfirmed course's", async () => {
    const a = course("u1", "a", true, [1000, 2000]);
    const b = course("u2", "b", true, [500]);
    const pending = course("u2", "pending", false, [700]);

    expect(await purgeConfirmedCoursePhotos({ db, volumeRoot: volume }, { dryRun: false })).toEqual({ dryRun: false, courses: 2, files: 3, bytes: 3500 });

    expect(existsSync(a)).toBe(false);
    expect(existsSync(b)).toBe(false);
    expect(pageRows("a") + pageRows("b")).toBe(0);
    expect(existsSync(pending)).toBe(true);
    expect(pageRows("pending")).toBe(1);
    // Run again: nothing left to do.
    expect(await purgeConfirmedCoursePhotos({ db, volumeRoot: volume }, { dryRun: false })).toEqual({ dryRun: false, courses: 0, files: 0, bytes: 0 });
  });
});
