import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  Argon2PasswordHasher,
  createAccount,
  generateExercisesJobHandler,
  IngestionCourseTexts,
  ok,
  runWorkerTick,
  SqliteAccountRepository,
  SqliteCourseRepository,
  SqliteItemRepository,
  SqliteJobQueue,
  splitItemsJobHandler,
  uuidV7Generator,
  type ExerciseGenerator,
  type ItemProposal,
  type ItemSplitter,
} from "@studiakids/core";
import { sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { openDatabase, type Db } from "../db/connection.js";
import { runMigrations } from "../db/migrate.js";

const PASSWORD = "correct-horse";
const AT = "2026-09-26T08:00:00.000Z";
const LESSON = "# Le verbe\n\nLe verbe indique ce que fait le sujet. Hier, Léa chantait. Aujourd'hui, Léa chante. Demain, Léa chantera.";

const proposals = (count: number): ItemProposal[] =>
  Array.from({ length: count }, (_, i) => ({ title: `Le verbe, point ${String(i + 1)}`, body: "Le verbe indique ce que fait le sujet.", applicableGameTypes: i === 0 ? ["cloze", "true_false"] : ["true_false"] }));
const splitterOf = (count: number): ItemSplitter => ({ split: () => Promise.resolve(ok(proposals(count))) });
const generator: ExerciseGenerator = {
  generate: ({ type, items }) =>
    Promise.resolve(
      ok(
        items.map((_, item) =>
          type === "cloze" ? { item, text: "Le {{0}} indique ce que fait le sujet.", blanks: ["verbe"] } : { item, statement: "Le verbe indique ce que fait le sujet.", answer: true },
        ),
      ),
    ),
};

// docs/modules/exercise-generator.md, API.
describe("generation routes", () => {
  let volume: string;
  let db: Db;
  let app: ReturnType<typeof buildApp>;
  let lea: string;
  let tom: string;

  async function login(username: string): Promise<string> {
    const res = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username, password: PASSWORD } });
    const raw = res.headers["set-cookie"];
    const match = /^([^=]+)=([^;]+)/.exec(Array.isArray(raw) ? (raw[0] ?? "") : (raw ?? ""));
    if (!match) throw new Error("no session cookie");
    return `${match[1]}=${match[2]}`;
  }

  function seedCourse(username: string, confirmed = true): string {
    const userId = db.get<{ id: string }>(sql`SELECT id FROM accounts WHERE username = ${username}`).id;
    const id = uuidV7Generator.next();
    db.run(sql`INSERT INTO courses (id, user_id, title, grade, color, extraction_status, confirmed, created_at, last_accessed_at)
               VALUES (${id}, ${userId}, 'Le verbe', 'CE2', 'matiere-francais', 'ready', ${confirmed ? 1 : 0}, ${AT}, ${AT})`);
    db.run(sql`INSERT INTO extractions (course_id, markdown, extracted_at) VALUES (${id}, ${LESSON}, ${AT})`);
    return id;
  }

  // The worker's own handlers over the real repositories; only the model
  // adapters are scripted.
  async function drainJobs(splitter: ItemSplitter): Promise<void> {
    const deps = { courses: new IngestionCourseTexts(new SqliteCourseRepository(db)), repo: new SqliteItemRepository(db), idGenerator: uuidV7Generator };
    const jobQueue = new SqliteJobQueue(db, uuidV7Generator);
    const handlers = new Map([
      ["split-items", splitItemsJobHandler({ ...deps, splitter, jobQueue })],
      ["generate-exercises", generateExercisesJobHandler({ ...deps, generator })],
    ]);
    while ((await runWorkerTick({ jobQueue, handlers }, new Date())) === "claimed");
  }

  const get = (url: string, cookie = lea) => app.inject({ method: "GET", url, headers: { cookie } });
  const post = (url: string, cookie = lea) => app.inject({ method: "POST", url, headers: { cookie } });
  const jobCount = () => db.all(sql`SELECT id FROM jobs`).length;

  beforeEach(async () => {
    volume = mkdtempSync(path.join(tmpdir(), "studiakids-api-generation-"));
    const dbPath = path.join(volume, "test.db");
    db = openDatabase(dbPath);
    runMigrations(db);
    const accounts = { accountRepository: new SqliteAccountRepository(db), passwordHasher: new Argon2PasswordHasher(), idGenerator: uuidV7Generator };
    await createAccount(accounts, "lea", PASSWORD, "Léa", "CE2", new Date());
    await createAccount(accounts, "tom", PASSWORD, "Tom", "CE2", new Date());
    app = buildApp({ databasePath: dbPath, dataDir: volume, sessionSecret: "test-session-secret", cookieSecure: false });
    lea = await login("lea");
    tom = await login("tom");
  });

  afterEach(async () => {
    await app.close();
    rmSync(volume, { recursive: true, force: true });
  });

  it("« Créer mes jeux » starts the splitting once: a second tap answers the same status and enqueues nothing", async () => {
    const id = seedCourse("lea");
    expect((await get(`/api/courses/${id}/generation-status`)).json()).toEqual({ status: "not_started", done: 0, total: 0, failed: 0, itemCount: 0 });

    const first = await post(`/api/courses/${id}/generate`);
    const second = await post(`/api/courses/${id}/generate`);

    expect(first.statusCode).toBe(202);
    expect(first.json()).toEqual({ status: "splitting", done: 0, total: 0, failed: 0, itemCount: 0 });
    expect(second.statusCode).toBe(202);
    expect(second.json()).toEqual(first.json());
    expect(jobCount()).toBe(1);
  });

  it("a course the child has not confirmed cannot be generated: 409 not_ready", async () => {
    const id = seedCourse("lea", false);

    const res = await post(`/api/courses/${id}/generate`);

    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: "not_ready" });
    expect(jobCount()).toBe(0);
  });

  it("the generation runs to ready: status, ordered items, each item's exercises, and the games count on the course list", async () => {
    const id = seedCourse("lea");
    await post(`/api/courses/${id}/generate`);

    await drainJobs(splitterOf(9));

    expect((await get(`/api/courses/${id}/generation-status`)).json()).toEqual({ status: "ready", done: 2, total: 2, failed: 0, itemCount: 9 });
    const items = (await get(`/api/courses/${id}/items`)).json<{ items: { id: string; title: string; gameTypes: string[]; position: number }[] }>().items;
    expect(items.map((item) => item.position)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(items[0]).toMatchObject({ title: "Le verbe, point 1", gameTypes: ["cloze", "true_false"] });
    const exercises = (await get(`/api/items/${items[0]!.id}/exercises`)).json<{ exercises: { type: string; itemId: string; content: unknown }[] }>().exercises;
    expect(exercises.map((exercise) => exercise.type).sort()).toEqual(["cloze", "true_false"]);
    expect(exercises[0]!.itemId).toBe(items[0]!.id);
    expect((await get("/api/courses")).json()).toEqual({ courses: [expect.objectContaining({ id, exerciseCount: 10 })] });
  });

  it("a lesson too short ends as insufficient coverage, with no item and no game", async () => {
    const id = seedCourse("lea");
    await post(`/api/courses/${id}/generate`);

    await drainJobs(splitterOf(5));

    expect((await get(`/api/courses/${id}/generation-status`)).json()).toEqual({ status: "insufficient_coverage", done: 0, total: 0, failed: 0, itemCount: 0 });
    expect((await get(`/api/courses/${id}/items`)).json()).toEqual({ items: [] });
    expect((await get("/api/courses")).json()).toEqual({ courses: [expect.objectContaining({ id, exerciseCount: 0 })] });
  });

  it("regenerating an item enqueues one job per type of that item only, and keeps the course ready", async () => {
    const id = seedCourse("lea");
    await post(`/api/courses/${id}/generate`);
    await drainJobs(splitterOf(9));
    const item = (await get(`/api/courses/${id}/items`)).json<{ items: { id: string }[] }>().items[0]!;
    const before = jobCount();

    const res = await post(`/api/items/${item.id}/regenerate`);

    expect(res.statusCode).toBe(202);
    const payloads = db.all<{ payload: string }>(sql`SELECT payload_json AS payload FROM jobs ORDER BY created_at, id`).slice(before).map((row) => JSON.parse(row.payload) as unknown);
    expect(payloads).toEqual([
      { courseId: id, type: "cloze", itemIds: [item.id] },
      { courseId: id, type: "true_false", itemIds: [item.id] },
    ]);
    expect((await get(`/api/courses/${id}/generation-status`)).json()).toMatchObject({ status: "ready" });
  });

  // Security (docs/securite.md): another account's course or item answers
  // exactly like an unknown id, and nothing is enqueued for it.
  describe("another account's course or item answers exactly like an unknown id", () => {
    const comparable = (headers: Record<string, unknown>) => {
      const { date: _date, "set-cookie": _cookie, ...rest } = headers;
      return rest;
    };
    const routes: { name: string; method: "GET" | "POST"; url: (courseId: string, itemId: string) => string }[] = [
      { name: "generate", method: "POST", url: (c) => `/api/courses/${c}/generate` },
      { name: "generation-status", method: "GET", url: (c) => `/api/courses/${c}/generation-status` },
      { name: "items", method: "GET", url: (c) => `/api/courses/${c}/items` },
      { name: "exercises", method: "GET", url: (_c, i) => `/api/items/${i}/exercises` },
      { name: "regenerate", method: "POST", url: (_c, i) => `/api/items/${i}/regenerate` },
    ];

    for (const route of routes) {
      it(`${route.name}: 404, same body and headers as an unknown id`, async () => {
        const id = seedCourse("lea");
        await post(`/api/courses/${id}/generate`);
        await drainJobs(splitterOf(9));
        const itemId = (await get(`/api/courses/${id}/items`)).json<{ items: { id: string }[] }>().items[0]!.id;
        const before = jobCount();
        const unknown = uuidV7Generator.next();

        const other = await app.inject({ method: route.method, url: route.url(id, itemId), headers: { cookie: tom } });
        const missing = await app.inject({ method: route.method, url: route.url(unknown, unknown), headers: { cookie: tom } });

        expect(other.statusCode).toBe(404);
        expect(missing.statusCode).toBe(404);
        expect(other.body).toBe(missing.body);
        expect(comparable(other.headers)).toEqual(comparable(missing.headers));
        expect(jobCount()).toBe(before);
      });
    }
  });
});
