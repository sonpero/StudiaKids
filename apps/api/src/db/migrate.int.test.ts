import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { sql } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { openDatabase } from "./connection.js";
import { runMigrations } from "./migrate.js";

describe("openDatabase", () => {
  let dir: string;
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  function tempDbPath(): string {
    dir = mkdtempSync(path.join(tmpdir(), "studiakids-db-"));
    return path.join(dir, "test.db");
  }

  it("sets the required pragmas (CLAUDE.md, SQLite specifics)", () => {
    const db = openDatabase(tempDbPath());

    const journalMode = db.get<{ journal_mode: string }>(sql`PRAGMA journal_mode`);
    const busyTimeout = db.get<{ timeout: number }>(sql`PRAGMA busy_timeout`);
    const synchronous = db.get<{ synchronous: number }>(sql`PRAGMA synchronous`);
    const foreignKeys = db.get<{ foreign_keys: number }>(sql`PRAGMA foreign_keys`);

    expect(journalMode?.journal_mode).toBe("wal");
    expect(busyTimeout?.timeout).toBe(5000);
    expect(synchronous?.synchronous).toBe(1); // NORMAL
    expect(foreignKeys?.foreign_keys).toBe(1);
  });
});

describe("runMigrations", () => {
  let dir: string;
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  function tempDbPath(): string {
    dir = mkdtempSync(path.join(tmpdir(), "studiakids-migrate-"));
    return path.join(dir, "test.db");
  }

  it("replays cleanly on an empty database with no migrations yet (M0: no business table exists)", () => {
    const db = openDatabase(tempDbPath());

    expect(() => runMigrations(db)).not.toThrow();
  });

  it("is idempotent: running it twice on the same database does not throw", () => {
    const dbPath = tempDbPath();
    const db = openDatabase(dbPath);
    runMigrations(db);

    expect(() => runMigrations(db)).not.toThrow();
  });
});
