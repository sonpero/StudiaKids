import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Argon2PasswordHasher, createAccount, SqliteAccountRepository, uuidV7Generator } from "@studiakids/core";
import { sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { openDatabase, type Db } from "./db/connection.js";
import { runMigrations } from "./db/migrate.js";

const workerDir = fileURLToPath(new URL("../../worker", import.meta.url));
const photosDir = fileURLToPath(new URL("../../../tests/fixtures/ingestion/photos", import.meta.url));
const BOUNDARY = "----studiakids-pipeline-test";

function extractCookie(setCookieHeader: string | string[] | undefined): string {
  const raw = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader;
  const match = raw ? /^([^=]+)=([^;]+)/.exec(raw) : null;
  if (!match) throw new Error("expected a session cookie");
  return `${match[1]}=${match[2]}`;
}

function multipart(bytes: Buffer): { payload: Buffer; headers: Record<string, string> } {
  return {
    payload: Buffer.concat([
      Buffer.from(`--${BOUNDARY}\r\nContent-Disposition: form-data; name="photo"; filename="page.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`),
      bytes,
      Buffer.from(`\r\n--${BOUNDARY}--\r\n`),
    ]),
    headers: { "content-type": `multipart/form-data; boundary=${BOUNDARY}` },
  };
}

async function waitFor<T>(read: () => Promise<T>, done: (value: T) => boolean, timeoutMs = 20_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await read();
    if (done(value) || Date.now() > deadline) return value;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

// docs/jalons.md, M3: photo → extraction → « Créer mes jeux » → split →
// one generation job per type, all in the real worker process
// (LLM_ADAPTER=fixture, recorded claude-sonnet-5 answers), status read
// through the API. Both share one volume, as on Railway.
describe("generation pipeline: API, real worker, recorded fixtures", () => {
  let volume: string;
  let db: Db;
  let app: ReturnType<typeof buildApp>;
  let worker: ChildProcess | undefined;
  let workerOutput = "";

  beforeEach(async () => {
    volume = mkdtempSync(path.join(tmpdir(), "studiakids-generation-"));
    mkdirSync(path.join(volume, "db"));
    const dbPath = path.join(volume, "db", "studiakids.db");
    db = openDatabase(dbPath);
    runMigrations(db);
    const accounts = { accountRepository: new SqliteAccountRepository(db), passwordHasher: new Argon2PasswordHasher(), idGenerator: uuidV7Generator };
    await createAccount(accounts, "lea", "correct-horse", "Léa", "CE2", new Date());
    app = buildApp({ databasePath: dbPath, dataDir: volume, sessionSecret: "test-session-secret", cookieSecure: false });
  });

  afterEach(async () => {
    worker?.kill();
    await app.close();
    rmSync(volume, { recursive: true, force: true });
  });

  function startWorker(): void {
    worker = spawn(path.join(workerDir, "node_modules/.bin/tsx"), ["src/index.ts"], {
      cwd: workerDir,
      env: { PATH: process.env.PATH, RAILWAY_VOLUME_MOUNT_PATH: volume, LLM_ADAPTER: "fixture" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    worker.stdout?.on("data", (chunk: Buffer) => (workerOutput += chunk.toString()));
    worker.stderr?.on("data", (chunk: Buffer) => (workerOutput += chunk.toString()));
  }

  async function confirmedCourse(cookie: string, fixturePhoto: string): Promise<string> {
    const courseId = (await app.inject({ method: "POST", url: "/api/courses", headers: { cookie } })).json<{ id: string }>().id;
    const body = multipart(readFileSync(path.join(photosDir, `${fixturePhoto}.jpg`)));
    expect((await app.inject({ method: "POST", url: `/api/courses/${courseId}/pages`, headers: { cookie, ...body.headers }, payload: body.payload })).statusCode).toBe(201);
    expect((await app.inject({ method: "POST", url: `/api/courses/${courseId}/extract`, headers: { cookie } })).statusCode).toBe(202);
    const read = () => app.inject({ method: "GET", url: `/api/courses/${courseId}`, headers: { cookie } }).then((res) => res.json<{ extractionStatus: string }>());
    expect(await waitFor(read, (course) => course.extractionStatus === "ready"), workerOutput).toMatchObject({ extractionStatus: "ready" });
    expect((await app.inject({ method: "POST", url: `/api/courses/${courseId}/confirm`, headers: { cookie } })).statusCode).toBe(204);
    return courseId;
  }

  it("a lesson generates games in several types; a lesson too short ends as insufficient coverage", async () => {
    const login = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: "lea", password: "correct-horse" } });
    const cookie = extractCookie(login.headers["set-cookie"]);
    startWorker();
    const lesson = await confirmedCourse(cookie, "legible");
    const short = await confirmedCourse(cookie, "legible-short");

    for (const courseId of [lesson, short]) expect((await app.inject({ method: "POST", url: `/api/courses/${courseId}/generate`, headers: { cookie } })).statusCode).toBe(202);
    const generation = (courseId: string) =>
      app.inject({ method: "GET", url: `/api/courses/${courseId}/generation-status`, headers: { cookie } }).then((res) => res.json<{ status: string; done: number; total: number; itemCount: number }>());

    const ready = await waitFor(() => generation(lesson), (progress) => progress.status === "ready" || progress.status === "failed");
    expect(ready, workerOutput).toMatchObject({ status: "ready", failed: 0 });
    expect(ready.itemCount).toBeGreaterThanOrEqual(8);
    const types = db.all<{ type: string }>(sql`SELECT DISTINCT type FROM exercises`).map((row) => row.type);
    expect(types.length, workerOutput).toBeGreaterThanOrEqual(2);
    expect(await waitFor(() => generation(short), (progress) => progress.status !== "splitting"), workerOutput).toMatchObject({ status: "insufficient_coverage", itemCount: 0 });
    const list = (await app.inject({ method: "GET", url: "/api/courses", headers: { cookie } })).json<{ courses: { id: string; exerciseCount: number }[] }>().courses;
    expect(list.find((course) => course.id === lesson)?.exerciseCount).toBeGreaterThan(0);
    expect(list.find((course) => course.id === short)?.exerciseCount).toBe(0);
  }, 90_000);
});
