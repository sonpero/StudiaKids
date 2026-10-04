import { describe, expect, it } from "vitest";
import { ok } from "../../shared/index.js";
import type { ItemProposal } from "../domain/items.js";
import { courseTexts, fakeItemRepository, fakeJobQueue, scriptedGenerator, scriptedSplitter, sequentialIds } from "./fakes.js";
import { handleGenerationJob } from "./handle-generation-job.js";
import { handleSplittingJob } from "./handle-splitting-job.js";

// docs/modules/exercise-generator.md, "Règles par matière": the course's
// subject reaches the split and the generation, and an exercise forbidden
// for it is dropped whatever the model sent.
const now = new Date("2026-10-04T10:00:00.000Z");
const ctx = { jobId: "j", userId: "u1", attempt: 1, now };
const MATHS = `# La table de 7
7 × 1 = 7
7 × 2 = 14
7 × 3 = 21
Le résultat d'une multiplication s'appelle le produit.`;

const item = (title: string, types: string[]): ItemProposal => ({ title, body: `${title} : 7 × 2 = 14.`, applicableGameTypes: types });
const six = (types: string[]) => ["Sept fois un", "Sept fois deux", "Sept fois trois", "Le produit", "La table de sept", "Le double de sept"].map((t) => item(t, types));

function setup(subject: "maths" | "french" | null = "maths") {
  return { repo: fakeItemRepository(), jobQueue: fakeJobQueue(), courses: courseTexts({ c1: MATHS }, "u1", "CE2", { c1: subject }), idGenerator: sequentialIds() };
}

async function splitInto(deps: ReturnType<typeof setup>, proposals: ItemProposal[]) {
  const splitter = scriptedSplitter([ok(proposals)]);
  await handleSplittingJob({ ...deps, splitter }, { courseId: "c1" }, ctx);
  return splitter;
}

describe("the subject reaches the split", () => {
  it("the splitter is told the course is maths", async () => {
    const deps = setup("maths");
    const splitter = await splitInto(deps, six(["mental_math"]));
    expect(splitter.inputs[0]).toEqual(expect.objectContaining({ subject: "maths" }));
  });

  it("maths: a delayed copy proposed for an item is dropped from its types, and no job is enqueued for it", async () => {
    const deps = setup("maths");
    await splitInto(deps, six(["delayed_copy", "mental_math"]));

    expect(deps.repo.items.every((i) => !i.applicableGameTypes.includes("delayed_copy"))).toBe(true);
    expect(deps.jobQueue.rows.map((row) => (row.payload as { type?: string }).type).filter(Boolean)).toEqual(["mental_math"]);
  });

  it("maths: an item proposed only for a delayed copy is no item at all", async () => {
    const deps = setup("maths");
    await splitInto(deps, [...six(["mental_math"]), item("Le mot produit", ["delayed_copy"])]);
    expect(deps.repo.items.map((i) => i.title)).not.toContain("Le mot produit");
  });

  it("french keeps its delayed copies", async () => {
    const deps = setup("french");
    await splitInto(deps, six(["delayed_copy"]));
    expect(deps.repo.items.every((i) => i.applicableGameTypes.includes("delayed_copy"))).toBe(true);
  });
});

describe("the subject reaches the generation, and the filter after it", () => {
  it("the generator is told the course is maths", async () => {
    const deps = setup("maths");
    await splitInto(deps, six(["mental_math"]));
    const generator = scriptedGenerator({ mental_math: [ok([{ item: 0, question: "7 × 2", answer: 14 }])] });

    await handleGenerationJob({ ...deps, generator }, { courseId: "c1", type: "mental_math" }, ctx);

    expect(generator.inputs[0]).toEqual(expect.objectContaining({ subject: "maths" }));
  });

  it("maths: a cloze whose blank is a word is dropped, one whose blank is a number is kept", async () => {
    const deps = setup("maths");
    await splitInto(deps, six(["cloze"]));
    const generator = scriptedGenerator({
      cloze: [
        ok([
          { item: 0, text: "7 × 2 = {{0}}", blanks: ["14"] },
          { item: 1, text: "Le résultat d'une multiplication s'appelle le {{0}}.", blanks: ["produit"] },
          { item: 2, text: "7 × 3 = {{0}}", blanks: ["21"] },
          { item: 3, text: "7 × 1 = {{0}}", blanks: ["7"] },
        ]),
      ],
    });

    await handleGenerationJob({ ...deps, generator }, { courseId: "c1", type: "cloze" }, ctx);

    expect(deps.repo.exercises.map((e) => e.content)).toEqual([
      { type: "cloze", text: "7 × 2 = {{0}}", blanks: ["14"] },
      { type: "cloze", text: "7 × 3 = {{0}}", blanks: ["21"] },
      { type: "cloze", text: "7 × 1 = {{0}}", blanks: ["7"] },
    ]);
  });

  it("any subject: a reordering of a times table is dropped even when the lesson writes it in that order", async () => {
    const deps = setup(null);
    await splitInto(deps, six(["reordering"]));
    const table = { item: 0, elements: ["7 × 1 = 7", "7 × 2 = 14", "7 × 3 = 21"] };
    const generator = scriptedGenerator({ reordering: [ok([table]), ok([table])] });

    await handleGenerationJob({ ...deps, generator }, { courseId: "c1", type: "reordering" }, ctx);

    expect(deps.repo.exercises).toEqual([]);
  });

  it("maths: a delayed copy is never asked of the model, and one already there is removed", async () => {
    const deps = setup("maths");
    await splitInto(deps, six(["mental_math"]));
    // Items split before the rule could still carry it.
    deps.repo.items[0]!.applicableGameTypes = ["delayed_copy"];
    deps.repo.exercises.push({ id: "old", itemId: deps.repo.items[0]!.id, userId: "u1", type: "delayed_copy", content: { type: "delayed_copy", wordOrPhrase: "produit" }, createdAt: now.toISOString() });
    const generator = scriptedGenerator({});

    expect(await handleGenerationJob({ ...deps, generator }, { courseId: "c1", type: "delayed_copy" }, ctx)).toEqual(ok(undefined));

    expect(generator.asked).toEqual([]);
    expect(deps.repo.exercises).toEqual([]);
  });

  it("an exercise already there that the rules now forbid is removed, even when the new answer has none for its item", async () => {
    const deps = setup("maths");
    await splitInto(deps, six(["cloze"]));
    deps.repo.exercises.push({ id: "word", itemId: deps.repo.items[3]!.id, userId: "u1", type: "cloze", content: { type: "cloze", text: "Le résultat s'appelle le {{0}}.", blanks: ["produit"] }, createdAt: now.toISOString() });
    const generator = scriptedGenerator({ cloze: [ok([{ item: 0, text: "7 × 2 = {{0}}", blanks: ["14"] }]), ok([])] });

    await handleGenerationJob({ ...deps, generator }, { courseId: "c1", type: "cloze" }, ctx);

    expect(deps.repo.exercises.map((e) => e.id)).not.toContain("word");
  });
});
