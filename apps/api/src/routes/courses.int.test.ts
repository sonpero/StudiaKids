import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  Argon2PasswordHasher,
  createAccount,
  err,
  handleExtractionJob,
  LocalFileStore,
  ok,
  runWorkerTick,
  SqliteAccountRepository,
  SqliteCourseRepository,
  SqliteJobQueue,
  uuidV7Generator,
  type CourseNamer,
  type JobHandler,
  type PhotoExtractor,
} from "@studiakids/core";
import { sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { buildApp } from "../app.js";
import { openDatabase, type Db } from "../db/connection.js";
import { runMigrations } from "../db/migrate.js";

const PASSWORD = "correct-horse";

function extractCookie(setCookieHeader: string | string[] | undefined): string {
  const raw = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader;
  if (!raw) throw new Error("expected a Set-Cookie header");
  const match = /^([^=]+)=([^;]+)/.exec(raw);
  if (!match) throw new Error(`could not parse Set-Cookie header: ${raw}`);
  return `${match[1]}=${match[2]}`;
}

// A structurally valid JPEG whose scan data carries `seed`, so two seeds
// give two different photos.
function jpeg(seed: number): Uint8Array {
  const segment = (marker: number, payload: number[]) => [0xff, marker, (payload.length + 2) >> 8, (payload.length + 2) & 0xff, ...payload];
  return Uint8Array.from([
    0xff, 0xd8,
    ...segment(0xdb, [0, ...Array.from({ length: 64 }, () => 1)]),
    ...segment(0xda, [1, 1, 0, 0, 63, 0]),
    seed & 0xff, (seed >> 8) & 0xff,
    0xff, 0xd9,
  ]);
}

// A valid JPEG of exactly `size` bytes: the padding sits in the scan data,
// so metadata stripping keeps it whole.
function jpegOfSize(size: number): Uint8Array {
  const small = jpeg(1);
  const bytes = new Uint8Array(size);
  bytes.set(small.subarray(0, small.length - 2));
  bytes.set([0xff, 0xd9], size - 2);
  return bytes;
}

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

const BOUNDARY = "----studiakids-test-boundary";

function multipart(files: Uint8Array[]): { payload: Buffer; headers: Record<string, string> } {
  const parts = files.flatMap((bytes, i) => [
    Buffer.from(`--${BOUNDARY}\r\nContent-Disposition: form-data; name="photo"; filename="page-${String(i)}.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`),
    Buffer.from(bytes),
    Buffer.from("\r\n"),
  ]);
  return {
    payload: Buffer.concat([...parts, Buffer.from(`--${BOUNDARY}--\r\n`)]),
    headers: { "content-type": `multipart/form-data; boundary=${BOUNDARY}` },
  };
}

const extractCourseHandler = (db: Db, volume: string, extractor: PhotoExtractor, namer: CourseNamer): JobHandler<{ courseId: string }> => ({
  type: "extract-course",
  payloadSchema: z.object({ courseId: z.string() }),
  handle: (payload, ctx) => handleExtractionJob({ repo: new SqliteCourseRepository(db), fileStore: new LocalFileStore(volume), extractor, namer }, payload, ctx),
});

const legibleExtractor: PhotoExtractor = { extract: () => Promise.resolve(ok({ markdown: "# Les fractions", legible: true, isCoursePage: true })) };
const mathsNamer: CourseNamer = { suggest: () => Promise.resolve(ok({ title: "Les fractions", subject: "maths" as const })) };

describe("course routes", () => {
  let volume: string;
  let db: Db;
  let app: ReturnType<typeof buildApp>;
  let lea: string;
  let tom: string;

  async function login(username: string): Promise<string> {
    const res = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username, password: PASSWORD } });
    expect(res.statusCode).toBe(204);
    return extractCookie(res.headers["set-cookie"]);
  }

  async function createCourse(cookie: string): Promise<string> {
    const res = await app.inject({ method: "POST", url: "/api/courses", headers: { cookie } });
    expect(res.statusCode).toBe(201);
    return res.json<{ id: string }>().id;
  }

  function upload(cookie: string, courseId: string, ...files: Uint8Array[]) {
    const body = multipart(files);
    return app.inject({ method: "POST", url: `/api/courses/${courseId}/pages`, headers: { cookie, ...body.headers }, payload: body.payload });
  }

  function userId(username: string): string {
    const row = db.get<{ id: string }>(sql`SELECT id FROM accounts WHERE username = ${username}`);
    if (!row) throw new Error(`no account ${username}`);
    return row.id;
  }

  const pageRows = () => db.all(sql`SELECT course_id, page_index FROM pages`);

  beforeEach(async () => {
    volume = mkdtempSync(path.join(tmpdir(), "studiakids-api-courses-"));
    const dbPath = path.join(volume, "test.db");
    db = openDatabase(dbPath);
    runMigrations(db);
    const accounts = { accountRepository: new SqliteAccountRepository(db), passwordHasher: new Argon2PasswordHasher(), idGenerator: uuidV7Generator };
    await createAccount(accounts, "lea", PASSWORD, "Léa", "CM1", new Date());
    await createAccount(accounts, "tom", PASSWORD, "Tom", "CE2", new Date());

    app = buildApp({ databasePath: dbPath, dataDir: volume, sessionSecret: "test-session-secret", cookieSecure: false });
    lea = await login("lea");
    tom = await login("tom");
  });

  afterEach(async () => {
    await app.close();
    rmSync(volume, { recursive: true, force: true });
  });

  it("POST /api/courses creates an empty pending course with the account's grade, shown as the unconfirmed one", async () => {
    const id = await createCourse(lea);

    const res = await app.inject({ method: "GET", url: "/api/courses/unconfirmed", headers: { cookie: lea } });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ course: { id, grade: "CM1", extractionStatus: "pending", confirmed: false, pageCount: 0 } });
    expect(res.json<{ course: object }>().course).not.toHaveProperty("userId");
  });

  it("GET /api/courses/unconfirmed returns null when the account has no pending course", async () => {
    const res = await app.inject({ method: "GET", url: "/api/courses/unconfirmed", headers: { cookie: lea } });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ course: null });
  });

  it("creating a course replaces the previous unconfirmed one, files included", async () => {
    const first = await createCourse(lea);
    expect((await upload(lea, first, jpeg(1))).statusCode).toBe(201);

    await createCourse(lea);

    expect((await app.inject({ method: "GET", url: `/api/courses/${first}`, headers: { cookie: lea } })).statusCode).toBe(404);
    expect(existsSync(path.join(volume, "photos", userId("lea"), first))).toBe(false);
  });

  it("uploading a page writes the photo file and its row", async () => {
    const id = await createCourse(lea);

    const res = await upload(lea, id, jpeg(1));

    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ index: 0 });
    expect(existsSync(path.join(volume, "photos", userId("lea"), id, "0.jpg"))).toBe(true);
    expect(pageRows()).toEqual([{ course_id: id, page_index: 0 }]);
  });

  it("a file over 7,500,000 bytes is refused with a stable code, and nothing reaches the disk or the database", async () => {
    const id = await createCourse(lea);
    const tooLarge = new Uint8Array(7_500_001);
    tooLarge.set(jpeg(1));

    const res = await upload(lea, id, tooLarge);

    expect(res.statusCode).toBe(413);
    expect(res.json()).toEqual({ error: "too_large" });
    expect(pageRows()).toEqual([]);
    expect(existsSync(path.join(volume, "photos", userId("lea"), id))).toBe(false);
  });

  // The multipart plugin's default cap is Fastify's 1 MiB bodyLimit: a
  // real photo would be refused if app.ts did not raise it.
  it("a photo of exactly 7,500,000 bytes is accepted", async () => {
    const id = await createCourse(lea);

    const res = await upload(lea, id, jpegOfSize(7_500_000));

    expect(res.statusCode).toBe(201);
    expect(pageRows()).toEqual([{ course_id: id, page_index: 0 }]);
  });

  it("a request carrying two files stores only the first one", async () => {
    const id = await createCourse(lea);

    await upload(lea, id, jpeg(1), jpeg(2));

    expect(pageRows()).toEqual([{ course_id: id, page_index: 0 }]);
  });

  it("a request without a file is refused with a stable code", async () => {
    const id = await createCourse(lea);

    const res = await upload(lea, id);

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "missing_file" });
  });

  it("refuses a non-JPEG, a duplicate and a sixth page with stable codes", async () => {
    const id = await createCourse(lea);

    const png = await upload(lea, id, PNG);
    expect(png.statusCode).toBe(415);
    expect(png.json()).toEqual({ error: "unsupported" });

    expect((await upload(lea, id, jpeg(1))).statusCode).toBe(201);
    const duplicate = await upload(lea, id, jpeg(1));
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json()).toEqual({ error: "duplicate" });

    for (const seed of [2, 3, 4, 5]) expect((await upload(lea, id, jpeg(seed))).statusCode).toBe(201);
    const sixth = await upload(lea, id, jpeg(6));
    expect(sixth.statusCode).toBe(409);
    expect(sixth.json()).toEqual({ error: "too_many_pages" });
  });

  it("POST /api/courses/:id/extract refuses a course with no page", async () => {
    const id = await createCourse(lea);

    const res = await app.inject({ method: "POST", url: `/api/courses/${id}/extract`, headers: { cookie: lea } });

    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: "no_pages" });
  });

  it("a second extract call on the same course returns the same success response as the first, and enqueues nothing more", async () => {
    const id = await createCourse(lea);
    await upload(lea, id, jpeg(1));

    const first = await app.inject({ method: "POST", url: `/api/courses/${id}/extract`, headers: { cookie: lea } });
    const second = await app.inject({ method: "POST", url: `/api/courses/${id}/extract`, headers: { cookie: lea } });

    expect(first.statusCode).toBe(202);
    expect(second.statusCode).toBe(first.statusCode);
    expect(second.body).toBe(first.body);
    expect(db.all(sql`SELECT id FROM jobs WHERE type = 'extract-course'`)).toHaveLength(1);
  });

  it("extract answers the current state: pending when it enqueues", async () => {
    const id = await createCourse(lea);
    await upload(lea, id, jpeg(1));

    const res = await app.inject({ method: "POST", url: `/api/courses/${id}/extract`, headers: { cookie: lea } });

    expect(res.statusCode).toBe(202);
    expect(res.json()).toEqual({ extractionStatus: "pending" });
  });

  it("extract on a course whose reading is over answers the same success with its state, and enqueues nothing", async () => {
    const id = await createCourse(lea);
    await upload(lea, id, jpeg(1));
    await app.inject({ method: "POST", url: `/api/courses/${id}/extract`, headers: { cookie: lea } });
    const handlers = new Map([["extract-course", extractCourseHandler(db, volume, legibleExtractor, mathsNamer)]]);
    await runWorkerTick({ jobQueue: new SqliteJobQueue(db, uuidV7Generator), handlers }, new Date());

    const res = await app.inject({ method: "POST", url: `/api/courses/${id}/extract`, headers: { cookie: lea } });

    expect(res.statusCode).toBe(202);
    expect(res.json()).toEqual({ extractionStatus: "ready" });
    expect(db.all(sql`SELECT id FROM jobs`)).toHaveLength(1);
  });

  it("extract on a confirmed course is refused", async () => {
    const id = await createCourse(lea);
    await upload(lea, id, jpeg(1));
    await app.inject({ method: "POST", url: `/api/courses/${id}/extract`, headers: { cookie: lea } });
    const handlers = new Map([["extract-course", extractCourseHandler(db, volume, legibleExtractor, mathsNamer)]]);
    await runWorkerTick({ jobQueue: new SqliteJobQueue(db, uuidV7Generator), handlers }, new Date());
    await app.inject({ method: "POST", url: `/api/courses/${id}/confirm`, headers: { cookie: lea } });

    const res = await app.inject({ method: "POST", url: `/api/courses/${id}/extract`, headers: { cookie: lea } });

    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: "already_confirmed" });
  });

  it("status transitions are visible through the API, up to a confirmed course listed on the home screen", async () => {
    const id = await createCourse(lea);
    await upload(lea, id, jpeg(1));
    await app.inject({ method: "POST", url: `/api/courses/${id}/extract`, headers: { cookie: lea } });

    const queued = await app.inject({ method: "GET", url: `/api/courses/${id}`, headers: { cookie: lea } });
    expect(queued.json()).toMatchObject({ extractionStatus: "pending" });

    const now = new Date();
    const handlers = new Map([["extract-course", extractCourseHandler(db, volume, legibleExtractor, mathsNamer)]]);
    expect(await runWorkerTick({ jobQueue: new SqliteJobQueue(db, uuidV7Generator), handlers }, now)).toBe("claimed");

    const ready = await app.inject({ method: "GET", url: `/api/courses/${id}`, headers: { cookie: lea } });
    expect(ready.json()).toMatchObject({ extractionStatus: "ready", title: "Les fractions", subject: "maths", color: "matiere-maths" });

    expect((await app.inject({ method: "GET", url: "/api/courses", headers: { cookie: lea } })).json()).toEqual({ courses: [] });
    const confirmed = await app.inject({ method: "POST", url: `/api/courses/${id}/confirm`, headers: { cookie: lea } });
    expect(confirmed.statusCode).toBe(204);

    const list = await app.inject({ method: "GET", url: "/api/courses", headers: { cookie: lea } });
    expect(list.json()).toMatchObject({ courses: [{ id, title: "Les fractions", color: "matiere-maths", confirmed: true }] });
    expect((await app.inject({ method: "GET", url: "/api/courses/unconfirmed", headers: { cookie: lea } })).json()).toEqual({ course: null });
  });

  it("confirming a course that is not ready is refused", async () => {
    const id = await createCourse(lea);

    const res = await app.inject({ method: "POST", url: `/api/courses/${id}/confirm`, headers: { cookie: lea } });

    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: "not_ready" });
  });

  it("an exhausted extraction reads as failed, and retry puts it back in the queue", async () => {
    const id = await createCourse(lea);
    await upload(lea, id, jpeg(1));
    await app.inject({ method: "POST", url: `/api/courses/${id}/extract`, headers: { cookie: lea } });
    const broken: PhotoExtractor = { extract: () => Promise.resolve(err({ kind: "model-error" as const, message: "boom" })) };
    const handlers = new Map([["extract-course", extractCourseHandler(db, volume, broken, mathsNamer)]]);
    const jobQueue = new SqliteJobQueue(db, uuidV7Generator);

    const notYet = await app.inject({ method: "POST", url: `/api/courses/${id}/retry`, headers: { cookie: lea } });
    expect(notYet.statusCode).toBe(409);
    expect(notYet.json()).toEqual({ error: "not_failed" });

    // Far enough apart that every backoff delay has elapsed.
    for (const hours of [1, 2, 3]) await runWorkerTick({ jobQueue, handlers }, new Date(Date.now() + hours * 3_600_000));
    expect((await app.inject({ method: "GET", url: `/api/courses/${id}`, headers: { cookie: lea } })).json()).toMatchObject({ extractionStatus: "failed" });

    const retried = await app.inject({ method: "POST", url: `/api/courses/${id}/retry`, headers: { cookie: lea } });
    expect(retried.statusCode).toBe(202);
    expect((await app.inject({ method: "GET", url: `/api/courses/${id}`, headers: { cookie: lea } })).json()).toMatchObject({ extractionStatus: "pending" });
  });

  it("GET /api/courses/:id/pages/:index/file serves the stored photo as a private, non-sniffable, non-cached JPEG", async () => {
    const id = await createCourse(lea);
    await upload(lea, id, jpeg(1));

    const res = await app.inject({ method: "GET", url: `/api/courses/${id}/pages/0/file`, headers: { cookie: lea } });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("image/jpeg");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["cache-control"]).toBe("private, no-store");
    expect(new Uint8Array(res.rawPayload)).toEqual(jpeg(1));
  });

  it("reject deletes a never-confirmed course and its files", async () => {
    const id = await createCourse(lea);
    await upload(lea, id, jpeg(1));

    const res = await app.inject({ method: "POST", url: `/api/courses/${id}/reject`, headers: { cookie: lea } });

    expect(res.statusCode).toBe(204);
    expect(pageRows()).toEqual([]);
    expect(existsSync(path.join(volume, "photos", userId("lea"), id))).toBe(false);
  });

  it("DELETE /api/courses/:id deletes the row, the pages and the files", async () => {
    const id = await createCourse(lea);
    await upload(lea, id, jpeg(1));

    const res = await app.inject({ method: "DELETE", url: `/api/courses/${id}`, headers: { cookie: lea } });

    expect(res.statusCode).toBe(204);
    expect(pageRows()).toEqual([]);
    expect(readdirSync(path.join(volume, "photos", userId("lea")))).toEqual([]);
    expect((await app.inject({ method: "GET", url: `/api/courses/${id}`, headers: { cookie: lea } })).statusCode).toBe(404);
  });

  // Security (docs/modules/ingestion.md, Tests clés): another account's
  // course and an unknown id must be indistinguishable, body and headers.
  describe("another account's course answers exactly like an unknown id", () => {
    const routes: { name: string; method: "GET" | "POST" | "DELETE"; url: (id: string) => string; upload?: boolean }[] = [
      { name: "file", method: "GET", url: (id) => `/api/courses/${id}/pages/0/file` },
      { name: "detail", method: "GET", url: (id) => `/api/courses/${id}` },
      { name: "upload", method: "POST", url: (id) => `/api/courses/${id}/pages`, upload: true },
      { name: "extract", method: "POST", url: (id) => `/api/courses/${id}/extract` },
      { name: "confirm", method: "POST", url: (id) => `/api/courses/${id}/confirm` },
      { name: "reject", method: "POST", url: (id) => `/api/courses/${id}/reject` },
      { name: "retry", method: "POST", url: (id) => `/api/courses/${id}/retry` },
      { name: "delete", method: "DELETE", url: (id) => `/api/courses/${id}` },
    ];

    // Date and the re-issued session cookie change from one response to the
    // next whatever the route does; every other header must match.
    const comparableHeaders = (headers: Record<string, unknown>) => {
      const { date: _date, "set-cookie": _cookie, ...rest } = headers;
      return rest;
    };

    for (const route of routes) {
      it(`${route.name}: 404, same body and headers as an unknown id, and Léa's course is untouched`, async () => {
        const leasCourse = await createCourse(lea);
        expect((await upload(lea, leasCourse, jpeg(1))).statusCode).toBe(201);
        const unknownId = uuidV7Generator.next();

        const send = (id: string) => {
          if (!route.upload) return app.inject({ method: route.method, url: route.url(id), headers: { cookie: tom } });
          const body = multipart([jpeg(9)]);
          return app.inject({ method: route.method, url: route.url(id), headers: { cookie: tom, ...body.headers }, payload: body.payload });
        };
        const other = await send(leasCourse);
        const unknown = await send(unknownId);

        expect(other.statusCode).toBe(404);
        expect(unknown.statusCode).toBe(404);
        expect(other.body).toBe(unknown.body);
        expect(comparableHeaders(other.headers)).toEqual(comparableHeaders(unknown.headers));

        const stillThere = await app.inject({ method: "GET", url: `/api/courses/${leasCourse}`, headers: { cookie: lea } });
        expect(stillThere.json()).toMatchObject({ id: leasCourse, pageCount: 1, extractionStatus: "pending" });
        expect(db.all(sql`SELECT id FROM jobs`)).toEqual([]);
      });
    }
  });
});
