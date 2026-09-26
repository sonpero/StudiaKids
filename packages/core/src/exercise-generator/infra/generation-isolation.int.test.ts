import { sql } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { freshDb, type Db } from "../../../../../tests/support/db.js";
import { SqliteCourseRepository } from "../../ingestion/index.js";
import { runWorkerTick, SqliteJobQueue } from "../../jobs/index.js";
import { err, ok, uuidV7Generator } from "../../shared/index.js";
import { scriptedGenerator, scriptedSplitter } from "../application/fakes.js";
import { regenerateItem } from "../application/regenerate-item.js";
import { startGeneration } from "../application/start-generation.js";
import { generateExercisesJobHandler, splitItemsJobHandler } from "../application/job-handlers.js";
import type { ItemProposal } from "../domain/items.js";
import type { ExerciseGenerator } from "../domain/ports.js";
import { IngestionCourseTexts } from "./ingestion-course-texts.js";
import { SqliteItemRepository } from "./sqlite-item-repository.js";

// Acceptance (docs/jalons.md, M3, "Intégration"), on a real SQLite file
// with the real migrations, the real job queue and the worker's own
// handlers; only the model adapters are scripted.
const AT = "2026-09-26T10:00:00.000Z";
const LESSON = `# Le château fort
Il est entouré de hautes murailles et d'un fossé. Le pont-levis se lève en cas d'attaque.
Le donjon est la tour la plus haute. Le seigneur protège les paysans. Les chevaliers défendent le château.`;
const TITLES = ["Les murailles", "Le fossé", "Le pont-levis", "Le donjon", "Le seigneur", "Les paysans", "Les chevaliers", "Le château fort"];
const WORDS = ["murailles", "fossé", "pont-levis", "donjon", "seigneur", "paysans", "chevaliers", "château"];
const proposals: ItemProposal[] = TITLES.map((title) => ({ title, body: `${title} : ce que dit la leçon.`, applicableGameTypes: ["delayed_copy", "mcq"] }));
const copies = (words: readonly string[]) => words.map((wordOrPhrase, item) => ({ item, wordOrPhrase }));

function seed(db: Db): void {
  db.run(sql`INSERT INTO accounts (id, username, password_hash, session_version, first_name, grade, created_at) VALUES ('u1', 'lea', 'x', 1, 'Léa', 'CM1', ${AT})`);
  db.run(sql`INSERT INTO courses (id, user_id, title, grade, color, extraction_status, confirmed, created_at, last_accessed_at)
             VALUES ('c1', 'u1', 'Le château fort', 'CM1', 'matiere-histoire', 'ready', 1, ${AT}, ${AT})`);
  db.run(sql`INSERT INTO extractions (course_id, markdown, extracted_at) VALUES ('c1', ${LESSON}, ${AT})`);
}

describe("generation, isolated by type and by exercise (real SQLite, real jobs)", () => {
  let cleanup: (() => void) | undefined;
  afterEach(() => cleanup?.());

  function setup() {
    const fresh = freshDb();
    cleanup = fresh.cleanup;
    seed(fresh.db);
    const repo = new SqliteItemRepository(fresh.db);
    const jobQueue = new SqliteJobQueue(fresh.db, uuidV7Generator);
    const courses = new IngestionCourseTexts(new SqliteCourseRepository(fresh.db));
    return { db: fresh.db, repo, jobQueue, courses };
  }

  async function generate(deps: ReturnType<typeof setup>, generator: ExerciseGenerator): Promise<void> {
    const common = { courses: deps.courses, repo: deps.repo, idGenerator: uuidV7Generator };
    const handlers = new Map([
      ["split-items", splitItemsJobHandler({ ...common, jobQueue: deps.jobQueue, splitter: scriptedSplitter([ok(proposals)]) })],
      ["generate-exercises", generateExercisesJobHandler({ ...common, generator })],
    ]);
    // Far in the future: a failed job's backoff is already over, so a
    // failing type is retried up to its cap within this loop.
    let at = new Date(AT).getTime();
    while ((await runWorkerTick({ jobQueue: deps.jobQueue, handlers }, new Date((at += 3_600_000)))) === "claimed");
  }

  const exercises = (db: Db) => db.all<{ id: string; item_id: string; type: string; content_json: string }>(sql`SELECT id, item_id, type, content_json FROM exercises ORDER BY type, content_json`);

  it("an invalid exercise is dropped alone, and a type in failure does not stop the other types", async () => {
    const deps = setup();
    await startGeneration(deps, "u1", "c1", new Date(AT));
    // One copy of a word absent from the lesson (anchoring rule), one of a
    // bad shape, one pointing past the list: each dropped alone.
    const answers = [...copies(WORDS.slice(0, 6)), { item: 6, wordOrPhrase: "herse" }, { item: 7, wordOrPhrase: 3 }, { item: 42, wordOrPhrase: "donjon" }];
    const failing = Array.from({ length: 5 }, () => err({ kind: "model-error" as const, message: "overloaded" }));

    await generate(deps, scriptedGenerator({ delayed_copy: [ok(answers)], mcq: failing }));

    expect(exercises(deps.db).map((row) => row.type)).toEqual(Array(6).fill("delayed_copy"));
    const jobs = deps.db.all<{ type: string; status: string; payload: string; last_error: string | null }>(sql`SELECT type, status, payload_json AS payload, last_error FROM jobs WHERE type = 'generate-exercises'`);
    expect(jobs.map((job) => [(JSON.parse(job.payload) as { type: string }).type, job.status])).toEqual(expect.arrayContaining([["delayed_copy", "done"], ["mcq", "failed"]]));
    expect(jobs.find((job) => job.status === "failed")?.last_error).toBe("overloaded");
  });

  it("a regeneration replaces an item's exercises without ever duplicating a row, and keeps an unchanged one's id", async () => {
    const deps = setup();
    await startGeneration(deps, "u1", "c1", new Date(AT));
    const mcq = (answer: string, item: number) => ({ item, question: `Que dit la leçon, point ${String(item)} ?`, options: [answer, "a", "b", "c"], answer });
    await generate(deps, scriptedGenerator({ delayed_copy: [ok(copies(WORDS))], mcq: [ok(WORDS.map(mcq))] }));
    const before = exercises(deps.db);
    const donjon = deps.db.get<{ id: string }>(sql`SELECT id FROM items WHERE title = 'Le donjon'`).id;

    await regenerateItem({ repo: deps.repo, jobQueue: deps.jobQueue }, "u1", donjon, new Date(AT));
    // The item's copy comes back unchanged; its question changes.
    await generate(deps, scriptedGenerator({ delayed_copy: [ok(copies(["donjon"]))], mcq: [ok([mcq("tour", 0)])] }));

    const after = exercises(deps.db);
    expect(after).toHaveLength(before.length);
    const forDonjon = (rows: typeof after, type: string) => rows.find((row) => row.item_id === donjon && row.type === type);
    expect(forDonjon(after, "delayed_copy")?.id).toBe(forDonjon(before, "delayed_copy")?.id);
    expect(forDonjon(after, "mcq")?.id).not.toBe(forDonjon(before, "mcq")?.id);
    expect(JSON.parse(forDonjon(after, "mcq")?.content_json ?? "{}")).toMatchObject({ answer: "tour" });
    expect(after.filter((row) => row.item_id !== donjon)).toEqual(before.filter((row) => row.item_id !== donjon));
  });
});
