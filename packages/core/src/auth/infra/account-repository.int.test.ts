import { afterEach, describe, expect, it } from "vitest";
import { freshDb } from "../../../../../tests/support/db.js";
import { SqliteAccountRepository } from "./account-repository.js";

describe("SqliteAccountRepository", () => {
  let cleanup: (() => void) | undefined;
  afterEach(() => cleanup?.());

  it("inserts a new account and reads it back by username and by id", async () => {
    const { db, cleanup: c } = freshDb();
    cleanup = c;
    const repo = new SqliteAccountRepository(db);
    const now = new Date("2026-01-01T00:00:00Z");

    await repo.insertAccount("id-1", "alex", "hash1", "Alex", "CP", now);

    expect(await repo.findByUsername("alex")).toEqual({
      id: "id-1",
      username: "alex",
      firstName: "Alex",
      grade: "CP",
      createdAt: now.toISOString(),
      passwordHash: "hash1",
      sessionVersion: 1,
    });
    expect(await repo.findById("id-1")).toEqual({
      id: "id-1",
      username: "alex",
      firstName: "Alex",
      grade: "CP",
      createdAt: now.toISOString(),
      sessionVersion: 1,
    });
  });

  it("returns null for an unknown username or id", async () => {
    const { db, cleanup: c } = freshDb();
    cleanup = c;
    const repo = new SqliteAccountRepository(db);

    expect(await repo.findByUsername("ghost")).toBeNull();
    expect(await repo.findById("ghost")).toBeNull();
  });

  it("rejects inserting a second account with the same username", async () => {
    const { db, cleanup: c } = freshDb();
    cleanup = c;
    const repo = new SqliteAccountRepository(db);
    const now = new Date("2026-01-01T00:00:00Z");

    await repo.insertAccount("id-1", "alex", "hash1", "Alex", "CP", now);

    await expect(repo.insertAccount("id-2", "alex", "hash2", "Alex", "CP", now)).rejects.toThrow();
  });

  it("updatePasswordHash replaces the hash and increments sessionVersion", async () => {
    const { db, cleanup: c } = freshDb();
    cleanup = c;
    const repo = new SqliteAccountRepository(db);
    const t1 = new Date("2026-01-01T00:00:00Z");
    const t2 = new Date("2026-02-01T00:00:00Z");

    await repo.insertAccount("id-1", "alex", "hash1", "Alex", "CP", t1);
    await repo.updatePasswordHash("alex", "hash2", t2);

    const row = await repo.findByUsername("alex");
    expect(row).toEqual({
      id: "id-1",
      username: "alex",
      firstName: "Alex",
      grade: "CP",
      createdAt: t1.toISOString(),
      passwordHash: "hash2",
      sessionVersion: 2,
    });
  });

  it("deleteAccount removes the row", async () => {
    const { db, cleanup: c } = freshDb();
    cleanup = c;
    const repo = new SqliteAccountRepository(db);
    const now = new Date("2026-01-01T00:00:00Z");
    await repo.insertAccount("id-1", "alex", "hash1", "Alex", "CP", now);

    await repo.deleteAccount("id-1");

    expect(await repo.findById("id-1")).toBeNull();
  });
});
