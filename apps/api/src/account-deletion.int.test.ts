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
});
