import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { sql } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { openDatabase } from "./connection.js";
import { runMigrations } from "./migrate.js";

describe("worker's own db bootstrapping", () => {
  let dir: string;
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  function tempDbPath(): string {
    dir = mkdtempSync(path.join(tmpdir(), "studiakids-worker-db-"));
    return path.join(dir, "test.db");
  }

  it("sets the required pragmas and replays apps/api's migrations cleanly (CLAUDE.md, SQLite specifics)", () => {
    const db = openDatabase(tempDbPath());

    const journalMode = db.get<{ journal_mode: string }>(sql`PRAGMA journal_mode`);
    expect(journalMode?.journal_mode).toBe("wal");

    expect(() => runMigrations(db)).not.toThrow();
  });
});
