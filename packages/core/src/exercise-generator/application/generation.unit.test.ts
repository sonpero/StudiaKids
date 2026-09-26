import { describe, expect, it } from "vitest";
import { err, ok } from "../../shared/index.js";
import type { ItemProposal } from "../domain/items.js";
import { courseTexts, fakeItemRepository, fakeJobQueue, scriptedGenerator, scriptedSplitter, sequentialIds } from "./fakes.js";
import { getGenerationStatus } from "./get-generation-status.js";
import { GENERATE_EXERCISES_JOB, handleGenerationJob } from "./handle-generation-job.js";
import { handleSplittingJob, SPLIT_ITEMS_JOB } from "./handle-splitting-job.js";
import { regenerateItem } from "./regenerate-item.js";
import { startGeneration } from "./start-generation.js";

const now = new Date("2026-09-26T10:00:00.000Z");
const ctx = { jobId: "j", userId: "u1", attempt: 1, now };
const COURSE = `# Le château fort
Il est entouré de hautes murailles et d'un fossé.
- le pont-levis se lève en cas d'attaque ;
- le donjon est la tour la plus haute.
Le seigneur protège les paysans. Les chevaliers défendent le château.
Hier, Léa chantait. Aujourd'hui, Léa chante. Demain, Léa chantera.`;

const item = (title: string, types: string[] = ["true_false"]): ItemProposal => ({ title, body: `${title} : ce que dit la leçon.`, applicableGameTypes: types });
const eight = (types: string[] = ["true_false"]) =>
  ["Les murailles", "Le fossé", "Le pont-levis", "Le donjon", "Le seigneur", "Les paysans", "Les chevaliers", "Le temps du verbe"].map((t) => item(t, types));
const tf = (n: number) => Array.from({ length: n }, (_, i) => ({ item: i, statement: `Phrase ${String(i)} de la leçon.`, answer: i % 2 === 0 }));

function setup() {
  const repo = fakeItemRepository();
  const jobQueue = fakeJobQueue();
  const courses = courseTexts({ c1: COURSE, unconfirmed: "" });
  return { repo, jobQueue, courses, idGenerator: sequentialIds() };
}

async function split(deps: ReturnType<typeof setup>, proposals: ItemProposal[]) {
  return handleSplittingJob({ ...deps, splitter: scriptedSplitter([ok(proposals)]) }, { courseId: "c1" }, ctx);
}

describe("startGeneration (« Créer mes jeux »)", () => {
  it("enqueues the split once, and a second tap changes nothing", async () => {
    const deps = setup();

    expect(await startGeneration(deps, "u1", "c1", now)).toEqual(ok(expect.objectContaining({ status: "splitting" })));
    expect(await startGeneration(deps, "u1", "c1", now)).toEqual(ok(expect.objectContaining({ status: "splitting" })));
    expect(deps.jobQueue.rows.map((r) => [r.type, r.payload])).toEqual([[SPLIT_ITEMS_JOB, { courseId: "c1" }]]);
  });

  it("refuses a course not ready or not confirmed, and another account's like an unknown one", async () => {
    const deps = setup();

    expect(await startGeneration(deps, "u1", "unconfirmed", now)).toEqual(err("not-ready"));
    expect(await startGeneration(deps, "u2", "c1", now)).toEqual(err("not-found"));
    expect(deps.jobQueue.rows).toEqual([]);
  });

  it("starts again after a failed split, never after insufficient coverage or once ready", async () => {
    const deps = setup();
    await startGeneration(deps, "u1", "c1", now);
    deps.jobQueue.rows[0]!.status = "failed";
    await startGeneration(deps, "u1", "c1", now);
    expect(deps.jobQueue.rows).toHaveLength(2);

    const short = setup();
    await split(short, eight().slice(0, 7));
    expect(await startGeneration(short, "u1", "c1", now)).toEqual(ok(expect.objectContaining({ status: "insufficient_coverage" })));
    expect(short.jobQueue.rows).toEqual([]);
  });
});

describe("handleSplittingJob", () => {
  it("writes the valid items and enqueues one generation job per game type present", async () => {
    const deps = setup();
    const proposals = eight(["true_false"]);
    proposals[0] = item("Les murailles", ["mcq", "quiz", "cloze"]);

    expect(await split(deps, proposals)).toEqual(ok(undefined));

    expect(deps.repo.items.map((i) => [i.position, i.title])).toHaveLength(8);
    expect(deps.repo.outcomes.get("u1/c1")).toEqual({ outcome: "items_ready", itemCount: 8 });
    expect(deps.jobQueue.rows.map((r) => r.payload)).toEqual([
      { courseId: "c1", type: "mcq" },
      { courseId: "c1", type: "cloze" },
      { courseId: "c1", type: "true_false" },
    ]);
    expect(deps.jobQueue.rows.every((r) => r.type === GENERATE_EXERCISES_JOB)).toBe(true);
  });

  it("below 8 valid items: no item, insufficient_coverage, no generation, and the job succeeds (never retried)", async () => {
    const deps = setup();
    const proposals = [...eight().slice(0, 7), item("Titre inconnu", ["quiz"])];

    expect(await split(deps, proposals)).toEqual(ok(undefined));
    expect(deps.repo.items).toEqual([]);
    expect(deps.repo.outcomes.get("u1/c1")).toEqual({ outcome: "insufficient_coverage", itemCount: 7 });
    expect(deps.jobQueue.rows).toEqual([]);
  });

  it("a splitter error goes back to the jobs kernel, which retries", async () => {
    const deps = setup();

    expect(await handleSplittingJob({ ...deps, splitter: scriptedSplitter([err({ kind: "model-error", message: "overloaded" })]) }, { courseId: "c1" }, ctx)).toEqual(err("overloaded"));
    expect(deps.repo.items).toEqual([]);
  });

  it("run again, it never calls the model twice nor duplicates items, and only enqueues missing type jobs", async () => {
    const deps = setup();
    await split(deps, eight(["true_false", "mcq"]));
    deps.jobQueue.rows.splice(1);
    const again = scriptedSplitter([]);

    expect(await handleSplittingJob({ ...deps, splitter: again }, { courseId: "c1" }, ctx)).toEqual(ok(undefined));
    expect(again.calls).toBe(0);
    expect(deps.repo.items).toHaveLength(8);
    expect(deps.jobQueue.rows.map((r) => r.payload)).toEqual([{ courseId: "c1", type: "true_false" }, { courseId: "c1", type: "mcq" }]);
  });

  it("ends quietly for a course that is no longer there", async () => {
    const deps = setup();
    const splitter = scriptedSplitter([]);

    expect(await handleSplittingJob({ ...deps, splitter }, { courseId: "gone" }, ctx)).toEqual(ok(undefined));
    expect(splitter.calls).toBe(0);
  });
});

describe("handleGenerationJob", () => {
  async function ready(types: string[] = ["true_false"]) {
    const deps = setup();
    await split(deps, eight(types));
    return deps;
  }
  const run = (deps: ReturnType<typeof setup>, generator: ReturnType<typeof scriptedGenerator>, type: "true_false" | "mcq" | "delayed_copy", itemIds?: string[]) =>
    handleGenerationJob({ ...deps, generator }, { courseId: "c1", type, ...(itemIds ? { itemIds } : {}) }, ctx);

  it("one call for the type and all its items, one exercise per item", async () => {
    const deps = await ready();
    const generator = scriptedGenerator({ true_false: [ok(tf(8))] });

    expect(await run(deps, generator, "true_false")).toEqual(ok(undefined));
    expect(generator.asked).toHaveLength(1);
    expect(generator.asked[0]?.items).toHaveLength(8);
    expect(deps.repo.exercises).toHaveLength(8);
  });

  // Acceptance (docs/jalons.md, M3): an invalid exercise is dropped alone.
  it("drops an invalid exercise alone (bad shape, item outside the list, anchoring broken), keeps the others", async () => {
    const deps = await ready();
    const answers = [...tf(6), { item: 6, statement: "Oui c'est vrai.", answer: true }, { item: 99, statement: "x", answer: true }, { item: 7, statement: 3 }];
    const generator = scriptedGenerator({ true_false: [ok(answers)] });

    await run(deps, generator, "true_false");

    expect(deps.repo.exercises).toHaveLength(6);
    expect(generator.asked).toHaveLength(1);
  });

  it("regenerates the type once below half valid, and keeps the better answer", async () => {
    const deps = await ready(["delayed_copy"]);
    const anchored = (n: number) => Array.from({ length: n }, (_, i) => ({ item: i, wordOrPhrase: ["murailles", "fossé", "pont-levis", "donjon", "seigneur", "paysans", "chevaliers", "chantera"][i] }));
    const invented = Array.from({ length: 8 }, (_, i) => ({ item: i, wordOrPhrase: "herse" }));
    const generator = scriptedGenerator({ delayed_copy: [ok([...anchored(3), ...invented.slice(3)]), ok(anchored(8))] });

    await run(deps, generator, "delayed_copy");

    expect(generator.asked).toHaveLength(2);
    expect(deps.repo.exercises).toHaveLength(8);
  });

  it("never regenerates more than once, and keeps what is valid even if it is little", async () => {
    const deps = await ready(["delayed_copy"]);
    const one = [{ item: 0, wordOrPhrase: "murailles" }];
    const generator = scriptedGenerator({ delayed_copy: [ok(one), ok([]), ok([])] });

    await run(deps, generator, "delayed_copy");

    expect(generator.asked).toHaveLength(2);
    expect(deps.repo.exercises).toHaveLength(1);
  });

  // Acceptance (docs/jalons.md, M3): a type in failure never stops the others.
  it("a failed type returns its error for a retry and leaves the other types' exercises alone", async () => {
    const deps = await ready(["true_false", "mcq"]);
    const generator = scriptedGenerator({ true_false: [ok(tf(8))], mcq: [err({ kind: "model-error", message: "overloaded" })] });

    expect(await run(deps, generator, "mcq")).toEqual(err("overloaded"));
    expect(await run(deps, generator, "true_false")).toEqual(ok(undefined));
    expect(deps.repo.exercises.map((e) => e.type)).toEqual(Array(8).fill("true_false"));
  });

  // The test that protects stars (docs/modules/exercise-generator.md).
  it("run again with the same content: the same exercise ids, never a duplicate", async () => {
    const deps = await ready();
    await run(deps, scriptedGenerator({ true_false: [ok(tf(8))] }), "true_false");
    const before = deps.repo.exercises.map((e) => e.id).sort();

    await run(deps, scriptedGenerator({ true_false: [ok(tf(8))] }), "true_false");

    expect(deps.repo.exercises.map((e) => e.id).sort()).toEqual(before);
  });

  it("a changed exercise replaces the old one under a new id; an item with nothing valid keeps its old one", async () => {
    const deps = await ready();
    await run(deps, scriptedGenerator({ true_false: [ok(tf(8))] }), "true_false");
    const old = new Map(deps.repo.exercises.map((e) => [e.itemId, e.id]));
    const changed = tf(8).map((e) => (e.item === 0 ? { ...e, statement: "Une autre phrase." } : e)).filter((e) => e.item !== 1);

    await run(deps, scriptedGenerator({ true_false: [ok(changed)] }), "true_false");

    const now1 = new Map(deps.repo.exercises.map((e) => [e.itemId, e.id]));
    const [first, second] = deps.repo.items;
    expect(now1.get(first!.id)).not.toBe(old.get(first!.id));
    expect(now1.get(second!.id)).toBe(old.get(second!.id));
    expect(deps.repo.exercises).toHaveLength(8);
  });

  it("limited to some items (a regeneration), it asks only for them", async () => {
    const deps = await ready();
    const target = deps.repo.items[2]!;
    const generator = scriptedGenerator({ true_false: [ok([{ item: 0, statement: "Le pont-levis se lève.", answer: true }])] });

    await run(deps, generator, "true_false", [target.id]);

    expect(generator.asked[0]?.items).toEqual([target.title]);
    expect(deps.repo.exercises.map((e) => e.itemId)).toEqual([target.id]);
  });
});

describe("getGenerationStatus", () => {
  it("follows the split and the type jobs, in game types", async () => {
    const deps = setup();
    expect(await getGenerationStatus(deps, "u1", "c1")).toEqual({ status: "not_started", done: 0, total: 0, failed: 0, itemCount: 0 });

    await startGeneration(deps, "u1", "c1", now);
    expect((await getGenerationStatus(deps, "u1", "c1")).status).toBe("splitting");

    deps.jobQueue.rows[0]!.status = "done";
    await split(deps, eight(["true_false", "mcq"]));
    const typeJobs = deps.jobQueue.rows.filter((r) => r.type === GENERATE_EXERCISES_JOB);
    typeJobs[0]!.status = "done";
    expect(await getGenerationStatus(deps, "u1", "c1")).toEqual({ status: "generating", done: 1, total: 2, failed: 0, itemCount: 8 });

    typeJobs[1]!.status = "failed";
    expect(await getGenerationStatus(deps, "u1", "c1")).toEqual({ status: "ready", done: 1, total: 2, failed: 1, itemCount: 8 });
  });

  it("a regeneration of one item never counts in the course's progress", async () => {
    const deps = setup();
    await split(deps, eight());
    deps.jobQueue.rows[0]!.status = "done";
    await regenerateItem(deps, "u1", deps.repo.items[0]!.id, now);

    expect(await getGenerationStatus(deps, "u1", "c1")).toEqual(expect.objectContaining({ status: "ready", done: 1, total: 1 }));
  });
});

describe("regenerateItem", () => {
  it("enqueues one generation job per type of the item, limited to it", async () => {
    const deps = setup();
    await split(deps, eight(["true_false", "mcq"]));
    const target = deps.repo.items[0]!;
    deps.jobQueue.rows.splice(0);

    expect(await regenerateItem(deps, "u1", target.id, now)).toEqual(ok(undefined));
    expect(deps.jobQueue.rows.map((r) => r.payload)).toEqual([
      { courseId: "c1", type: "true_false", itemIds: [target.id] },
      { courseId: "c1", type: "mcq", itemIds: [target.id] },
    ]);
  });

  it("treats another account's item like an unknown one", async () => {
    const deps = setup();
    await split(deps, eight());

    expect(await regenerateItem(deps, "u2", deps.repo.items[0]!.id, now)).toEqual(err("not-found"));
  });
});
