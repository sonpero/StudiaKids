import { sql } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { freshDb, type Db } from "../../../../../tests/support/db.js";
import { SqliteJobQueue } from "./sqlite-job-queue.js";

const now = new Date("2026-01-01T00:00:00.000Z");

// Minimal raw-SQL seed, not an import of auth's repository: jobs/**
// stays fully decoupled from auth even in its own tests, satisfying the
// jobs.user_id -> accounts(id) FK (`foreign_keys = ON`, see connection.ts)
// with the smallest possible fixture.
function seedUser(db: Db, id: string): void {
  db.run(
    sql`INSERT INTO accounts (id, username, password_hash, session_version, first_name, grade, created_at)
        VALUES (${id}, ${`user-${id}`}, 'x', 1, 'Test', 'CP', ${now.toISOString()})`,
  );
}

let idCounter = 0;
const idGenerator = { next: () => `job-${String(idCounter++)}` };

describe("SqliteJobQueue", () => {
  let cleanup: (() => void) | undefined;
  afterEach(() => cleanup?.());

  it("enqueue writes a pending row, readable back via listJobs", async () => {
    const { db, cleanup: c } = freshDb();
    cleanup = c;
    seedUser(db, "u1");
    const queue = new SqliteJobQueue(db, idGenerator);

    const id = await queue.enqueue("u1", "extract-course", { courseId: "d1" }, now);

    expect(await queue.listJobs("u1", "extract-course")).toEqual([
      { id, status: "pending", payload: { courseId: "d1" }, lastError: null },
    ]);
  });

  it("claimNext claims the oldest eligible pending job and flips it to running", async () => {
    const { db, cleanup: c } = freshDb();
    cleanup = c;
    seedUser(db, "u1");
    const queue = new SqliteJobQueue(db, idGenerator);
    const first = await queue.enqueue("u1", "extract-course", { a: 1 }, now);
    await queue.enqueue("u1", "extract-course", { a: 2 }, new Date(now.getTime() + 1000));

    const claimed = await queue.claimNext(new Date(now.getTime() + 2000));

    expect(claimed?.id).toBe(first);
    expect(claimed?.status).toBe("running");
  });

  it("claimNext returns null when nothing is eligible (empty queue, or runAfter in the future)", async () => {
    const { db, cleanup: c } = freshDb();
    cleanup = c;
    seedUser(db, "u1");
    const queue = new SqliteJobQueue(db, idGenerator);

    expect(await queue.claimNext(now)).toBeNull();

    await queue.enqueue("u1", "extract-course", {}, new Date(now.getTime() + 60_000));
    expect(await queue.claimNext(now)).toBeNull();
  });

  it("complete() sets status to done", async () => {
    const { db, cleanup: c } = freshDb();
    cleanup = c;
    seedUser(db, "u1");
    const queue = new SqliteJobQueue(db, idGenerator);
    const id = await queue.enqueue("u1", "extract-course", {}, now);
    await queue.claimNext(now);

    await queue.complete(id, now);

    expect((await queue.listJobs("u1", "extract-course"))[0]?.status).toBe("done");
  });

  it("fail() retries with backoff while attempts < maxAttempts, then ends failed with lastError populated on the 3rd failure", async () => {
    const { db, cleanup: c } = freshDb();
    cleanup = c;
    seedUser(db, "u1");
    const queue = new SqliteJobQueue(db, idGenerator);
    const id = await queue.enqueue("u1", "extract-course", {}, now);

    await queue.claimNext(now);
    await queue.fail(id, "error 1", now);
    let [job] = await queue.listJobs("u1", "extract-course");
    expect(job).toMatchObject({ status: "pending", lastError: "error 1" });

    await queue.claimNext(new Date(now.getTime() + 120_000));
    await queue.fail(id, "error 2", now);
    [job] = await queue.listJobs("u1", "extract-course");
    expect(job).toMatchObject({ status: "pending", lastError: "error 2" });

    await queue.claimNext(new Date(now.getTime() + 300_000));
    await queue.fail(id, "error 3", now);
    [job] = await queue.listJobs("u1", "extract-course");
    expect(job).toMatchObject({ status: "failed", lastError: "error 3" });
  });

  it("fail(..., { terminal: true }) goes straight to failed on the very first failure", async () => {
    const { db, cleanup: c } = freshDb();
    cleanup = c;
    seedUser(db, "u1");
    const queue = new SqliteJobQueue(db, idGenerator);
    const id = await queue.enqueue("u1", "unregistered-type", {}, now);
    await queue.claimNext(now);

    await queue.fail(id, 'No handler registered for job type "unregistered-type"', now, { terminal: true });

    expect((await queue.listJobs("u1", "unregistered-type"))[0]).toMatchObject({
      status: "failed",
      lastError: 'No handler registered for job type "unregistered-type"',
    });
  });

  it("recoverStale resets running rows to pending, leaves done and failed untouched, and returns the count", async () => {
    const { db, cleanup: c } = freshDb();
    cleanup = c;
    seedUser(db, "u1");
    const queue = new SqliteJobQueue(db, idGenerator);
    const running = await queue.enqueue("u1", "extract-course", {}, now);
    const done = await queue.enqueue("u1", "extract-course", {}, now);
    const failed = await queue.enqueue("u1", "extract-course", {}, now);
    await queue.claimNext(now); // claims `running`
    await queue.claimNext(now); // claims `done`
    await queue.complete(done, now);
    await queue.claimNext(now); // claims `failed`
    await queue.fail(failed, "boom", now, { terminal: true });

    const count = await queue.recoverStale(now);

    expect(count).toBe(1);
    const jobs = await queue.listJobs("u1", "extract-course");
    expect(jobs.find((j) => j.id === running)?.status).toBe("pending");
    expect(jobs.find((j) => j.id === done)?.status).toBe("done");
    expect(jobs.find((j) => j.id === failed)?.status).toBe("failed");
  });

  it("listJobs filters by userId and type, and honours createdAfter", async () => {
    const { db, cleanup: c } = freshDb();
    cleanup = c;
    seedUser(db, "u1");
    seedUser(db, "u2");
    const queue = new SqliteJobQueue(db, idGenerator);
    await queue.enqueue("u1", "extract-course", {}, now);
    await queue.enqueue("u1", "other-type", {}, now);
    await queue.enqueue("u2", "extract-course", {}, now);
    const later = await queue.enqueue("u1", "extract-course", {}, new Date(now.getTime() + 60_000));

    const jobs = await queue.listJobs("u1", "extract-course", new Date(now.getTime() + 30_000).toISOString());

    expect(jobs).toEqual([{ id: later, status: "pending", payload: {}, lastError: null }]);
  });

  it("listJobs returns newest first, matching the idx_jobs_user index order", async () => {
    const { db, cleanup: c } = freshDb();
    cleanup = c;
    seedUser(db, "u1");
    const queue = new SqliteJobQueue(db, idGenerator);
    const first = await queue.enqueue("u1", "extract-course", {}, now);
    const second = await queue.enqueue("u1", "extract-course", {}, new Date(now.getTime() + 1000));
    const third = await queue.enqueue("u1", "extract-course", {}, new Date(now.getTime() + 2000));

    const jobs = await queue.listJobs("u1", "extract-course");

    expect(jobs.map((j) => j.id)).toEqual([third, second, first]);
  });

  it("rejects a job for a user that does not exist (FK enforced)", () => {
    const { db, cleanup: c } = freshDb();
    cleanup = c;
    const queue = new SqliteJobQueue(db, idGenerator);

    expect(() => queue.enqueue("ghost-user", "extract-course", {}, now)).toThrow(/FOREIGN KEY/);
  });

  // Diverges from StudIA on purpose (docs/donnees.md): without the cascade,
  // pnpm accounts:delete fails on this FK as soon as the account has a job.
  it("deleting the account deletes its jobs, and only its jobs", async () => {
    const { db, cleanup: c } = freshDb();
    cleanup = c;
    seedUser(db, "u1");
    seedUser(db, "u2");
    const queue = new SqliteJobQueue(db, idGenerator);
    await queue.enqueue("u1", "extract-course", {}, now);
    const kept = await queue.enqueue("u2", "extract-course", {}, now);

    db.run(sql`DELETE FROM accounts WHERE id = 'u1'`);

    expect(await queue.listJobs("u1", "extract-course")).toEqual([]);
    expect((await queue.listJobs("u2", "extract-course")).map((j) => j.id)).toEqual([kept]);
  });

  // The next two pin constraints hand-added to the generated migration
  // (docs/modules/jobs.md, Persistance): a regenerated migration that
  // silently dropped them must fail here.
  it("rejects a status outside the state machine at the database level", () => {
    const { db, cleanup: c } = freshDb();
    cleanup = c;
    seedUser(db, "u1");

    let thrown: unknown;
    try {
      db.run(
        sql`INSERT INTO jobs (id, user_id, type, payload_json, status, run_after, created_at, updated_at)
            VALUES ('j1', 'u1', 'extract-course', '{}', 'paused', ${now.toISOString()}, ${now.toISOString()}, ${now.toISOString()})`,
      );
    } catch (error) {
      thrown = error;
    }

    // drizzle wraps raw-SQL failures; SQLite's own message is on `cause`.
    expect(thrown).toBeInstanceOf(Error);
    expect(String((thrown as Error).cause)).toMatch(/CHECK constraint/);
  });

  it("indexes created_at descending in idx_jobs_user", () => {
    const { db, cleanup: c } = freshDb();
    cleanup = c;

    const columns = db.all<{ name: string | null; desc: number }>(sql`PRAGMA index_xinfo('idx_jobs_user')`);

    expect(columns.filter((col) => col.name !== null).map((col) => [col.name, col.desc])).toEqual([
      ["user_id", 0],
      ["type", 0],
      ["created_at", 1],
    ]);
  });
});
