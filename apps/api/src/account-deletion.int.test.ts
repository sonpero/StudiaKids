import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  addPage,
  Argon2PasswordHasher,
  createAccount,
  createCourse,
  LocalFileStore,
  SqliteAccountRepository,
  SqliteCourseRepository,
  SqliteItemRepository,
  SqliteAttemptRepository,
  SqliteJobQueue,
  startExtraction,
  uuidV7Generator,
} from "@studiakids/core";
import { sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { deleteAccountWithPhotos } from "./account-deletion.js";
import { openDatabase, type Db } from "./db/connection.js";
import { runMigrations } from "./db/migrate.js";

const now = new Date("2026-09-26T10:00:00.000Z");
const jpeg = (seed: number) => Uint8Array.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43, 0x00, ...Array.from({ length: 64 }, () => 1), 0xff, 0xda, 0x00, 0x08, 1, 1, 0, 0, 63, 0, seed, 0, 0xff, 0xd9]);

// Acceptance (docs/jalons.md, M2): accounts:delete on an account with a
// photographed course removes its rows and its photos directory.
describe("deleteAccountWithPhotos", () => {
  let volume: string;
  let db: Db;

  beforeEach(() => {
    volume = mkdtempSync(path.join(tmpdir(), "studiakids-account-deletion-"));
    db = openDatabase(path.join(volume, "test.db"));
    runMigrations(db);
  });

  afterEach(() => rmSync(volume, { recursive: true, force: true }));

  async function accountWithCourse(username: string) {
    const accountRepository = new SqliteAccountRepository(db);
    await createAccount({ accountRepository, passwordHasher: new Argon2PasswordHasher(), idGenerator: uuidV7Generator }, username, "correct-horse", "Léa", "CM1", now);
    const account = await accountRepository.findByUsername(username);
    if (!account) throw new Error("account not created");
    const deps = { repo: new SqliteCourseRepository(db), fileStore: new LocalFileStore(volume), idGenerator: uuidV7Generator, jobQueue: new SqliteJobQueue(db, uuidV7Generator) };
    const course = await createCourse(deps, account.id, "CM1", now);
    if (!course.ok) throw new Error("course not created");
    const page = await addPage(deps, account.id, course.value.id, jpeg(1), now);
    if (!page.ok) throw new Error(page.error);
    await startExtraction(deps, account.id, course.value.id, now);
    return { userId: account.id, file: path.join(volume, page.value.storedPath) };
  }

  const count = (table: string, userId: string) =>
    db.get<{ n: number }>(sql.raw(`SELECT count(*) AS n FROM ${table} WHERE ${table === "accounts" ? "id" : "user_id"} = '${userId}'`)).n;

  it("removes the account's rows and its photos directory, and leaves another account alone", async () => {
    const lea = await accountWithCourse("lea");
    const tom = await accountWithCourse("tom");
    expect(existsSync(lea.file)).toBe(true);

    expect(await deleteAccountWithPhotos({ db, volumeRoot: volume }, "lea")).toBe("deleted");

    for (const table of ["accounts", "courses", "jobs"]) expect(count(table, lea.userId)).toBe(0);
    expect(db.get<{ n: number }>(sql`SELECT count(*) AS n FROM pages p JOIN courses c ON c.id = p.course_id WHERE c.user_id = ${lea.userId}`).n).toBe(0);
    expect(existsSync(path.join(volume, "photos", lea.userId))).toBe(false);

    for (const table of ["accounts", "courses", "jobs"]) expect(count(table, tom.userId)).toBe(1);
    expect(existsSync(tom.file)).toBe(true);
  });

  it("reports an unknown username without touching anything", async () => {
    const lea = await accountWithCourse("lea");

    expect(await deleteAccountWithPhotos({ db, volumeRoot: volume }, "nobody")).toBe("not-found");

    expect(count("accounts", lea.userId)).toBe(1);
    expect(existsSync(lea.file)).toBe(true);
  });

  // Decided at M3's opening: accounts:delete also removes the account's
  // items, exercises and split outcomes (ON DELETE CASCADE on user_id).
  it("removes the account's items, exercises and split outcomes too", async () => {
    const lea = await accountWithCourse("lea");
    const courseId = db.get<{ id: string }>(sql`SELECT id FROM courses WHERE user_id = ${lea.userId}`).id;
    db.run(sql`UPDATE courses SET extraction_status = 'ready', confirmed = 1 WHERE id = ${courseId}`);
    const items = new SqliteItemRepository(db);
    const item = { id: "i0", courseId, userId: lea.userId, title: "Le verbe", body: "b", applicableGameTypes: ["mcq" as const], position: 0, createdAt: now.toISOString() };
    await items.saveSplit(lea.userId, courseId, { items: [item], outcome: "items_ready", itemCount: 1 }, now);
    await items.applyExercises(lea.userId, { remove: [], insert: [{ id: "e0", itemId: "i0", userId: lea.userId, type: "mcq", content: { type: "mcq", question: "q", options: ["a", "b", "c", "d"], answer: "a" }, createdAt: now.toISOString() }] });
    expect([count("items", lea.userId), count("exercises", lea.userId), count("course_generations", lea.userId)]).toEqual([1, 1, 1]);

    expect(await deleteAccountWithPhotos({ db, volumeRoot: volume }, "lea")).toBe("deleted");

    expect([count("items", lea.userId), count("exercises", lea.userId), count("course_generations", lea.userId)]).toEqual([0, 0, 0]);
  });

  // Decided at M4's opening: accounts:delete also removes the account's
  // attempts (ON DELETE CASCADE on user_id).
  it("removes the account's attempts too, and leaves another account's alone", async () => {
    const seed = async (username: string, exerciseId: string) => {
      const account = await accountWithCourse(username);
      const courseId = db.get<{ id: string }>(sql`SELECT id FROM courses WHERE user_id = ${account.userId}`).id;
      db.run(sql`UPDATE courses SET extraction_status = 'ready', confirmed = 1 WHERE id = ${courseId}`);
      const item = { id: `i-${exerciseId}`, courseId, userId: account.userId, title: "Le verbe", body: "b", applicableGameTypes: ["true_false" as const], position: 0, createdAt: now.toISOString() };
      const items = new SqliteItemRepository(db);
      await items.saveSplit(account.userId, courseId, { items: [item], outcome: "items_ready", itemCount: 1 }, now);
      await items.applyExercises(account.userId, { remove: [], insert: [{ id: exerciseId, itemId: item.id, userId: account.userId, type: "true_false", content: { type: "true_false", statement: "Vrai.", answer: true }, createdAt: now.toISOString() }] });
      await new SqliteAttemptRepository(db).record(account.userId, [{ id: `a-${exerciseId}`, exerciseId, type: "true_false", unitId: "0", correct: true, starEligible: true }], now);
      return account.userId;
    };
    const lea = await seed("lea", "e-lea");
    const tom = await seed("tom", "e-tom");
    expect([count("attempts", lea), count("attempts", tom)]).toEqual([1, 1]);

    expect(await deleteAccountWithPhotos({ db, volumeRoot: volume }, "lea")).toBe("deleted");

    expect([count("attempts", lea), count("attempts", tom)]).toEqual([0, 1]);
  });
});
