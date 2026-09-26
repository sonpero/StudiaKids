import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Argon2PasswordHasher, createAccount, SqliteAccountRepository, SqliteJobQueue, uuidV7Generator } from "@studiakids/core";
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

// Acceptance (docs/jalons.md, M2): upload through the API, the real worker
// process (apps/worker, LLM_ADAPTER=fixture) handles the job, the status
// is visible through the API. Both share one volume, as on Railway.
describe("extraction pipeline: API, real worker, recorded fixtures", () => {
  let volume: string;
  let db: Db;
  let app: ReturnType<typeof buildApp>;
  let worker: ChildProcess | undefined;
  let workerOutput = "";

  beforeEach(async () => {
    volume = mkdtempSync(path.join(tmpdir(), "studiakids-pipeline-"));
    mkdirSync(path.join(volume, "db"));
    const dbPath = path.join(volume, "db", "studiakids.db");
    db = openDatabase(dbPath);
    runMigrations(db);
    const accounts = { accountRepository: new SqliteAccountRepository(db), passwordHasher: new Argon2PasswordHasher(), idGenerator: uuidV7Generator };
    await createAccount(accounts, "lea", "correct-horse", "Léa", "CM1", new Date());
    await createAccount(accounts, "tom", "correct-horse", "Tom", "CE2", new Date());
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

  async function photographed(username: string, fixturePhoto: string): Promise<{ cookie: string; courseId: string }> {
    const login = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username, password: "correct-horse" } });
    const cookie = extractCookie(login.headers["set-cookie"]);
    const courseId = (await app.inject({ method: "POST", url: "/api/courses", headers: { cookie } })).json<{ id: string }>().id;
    const body = multipart(readFileSync(path.join(photosDir, `${fixturePhoto}.jpg`)));
    expect((await app.inject({ method: "POST", url: `/api/courses/${courseId}/pages`, headers: { cookie, ...body.headers }, payload: body.payload })).statusCode).toBe(201);
    expect((await app.inject({ method: "POST", url: `/api/courses/${courseId}/extract`, headers: { cookie } })).statusCode).toBe(202);
    return { cookie, courseId };
  }

  const status = async ({ cookie, courseId }: { cookie: string; courseId: string }) =>
    (await app.inject({ method: "GET", url: `/api/courses/${courseId}`, headers: { cookie } })).json<{ extractionStatus: string; title: string; subject: string | null }>();

  it("a legible photo ends ready and named, a blurred one illegible; a replayed job still leaves one extraction", async () => {
    const legible = await photographed("lea", "legible");
    const blurred = await photographed("tom", "illegible");
    expect((await status(legible)).extractionStatus).toBe("pending");

    startWorker();

    const ready = await waitFor(() => status(legible), (course) => course.extractionStatus === "ready");
    expect(ready, workerOutput).toMatchObject({ extractionStatus: "ready", title: "Le verbe", subject: "french" });
    const unusable = await waitFor(() => status(blurred), (course) => course.extractionStatus === "illegible");
    expect(unusable, workerOutput).toMatchObject({ extractionStatus: "illegible", title: "" });
    expect(db.all(sql`SELECT unusable_reason FROM pages WHERE course_id = ${blurred.courseId}`)).toEqual([{ unusable_reason: expect.stringMatching(/\S/) as unknown }]);

    // The same job run again, as after a crash before it was marked done.
    const leaId = db.get<{ user_id: string }>(sql`SELECT user_id FROM courses WHERE id = ${legible.courseId}`).user_id;
    const replayId = await new SqliteJobQueue(db, uuidV7Generator).enqueue(leaId, "extract-course", { courseId: legible.courseId }, new Date());
    const replayed = await waitFor(
      () => Promise.resolve(db.get<{ status: string }>(sql`SELECT status FROM jobs WHERE id = ${replayId}`).status),
      (jobStatus) => jobStatus === "done",
    );
    expect(replayed, workerOutput).toBe("done");
    expect(db.all(sql`SELECT course_id FROM extractions`)).toEqual([{ course_id: legible.courseId }]);
    expect((await status(legible)).extractionStatus).toBe("ready");
  }, 60_000);
});
