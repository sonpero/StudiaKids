import { describe, expect, it } from "vitest";
import { FIXTURE_SOURCE, loadFixture, replayFetch } from "../../../../../tests/support/llm-fixtures.js";
import { createLanguageModel } from "../../shared/index.js";
import { courseTexts, fakeItemRepository, fakeJobQueue, sequentialIds } from "../application/fakes.js";
import { getGenerationStatus } from "../application/get-generation-status.js";
import { handleGenerationJob } from "../application/handle-generation-job.js";
import { handleSplittingJob } from "../application/handle-splitting-job.js";
import { GENERATE_EXERCISES_JOB, type GenerateExercisesPayload } from "../application/jobs.js";
import { GAME_TYPES } from "../domain/game-types.js";
import { COVERAGE_MIN_ITEMS, validItems } from "../domain/items.js";
import type { ExerciseGenerator } from "../domain/ports.js";
import { ClaudeExerciseGenerator } from "./claude-exercise-generator.js";
import { ClaudeItemSplitter } from "./claude-item-splitter.js";

// Contract tests: raw claude-sonnet-5 responses recorded on the text of
// ingestion's recorded pages (tests/fixtures/exercise-generator/, each
// file names its source), replayed through the real adapters — Zod
// validation, repair and retry included — and through the job handlers.
const now = new Date("2026-09-26T10:00:00Z");
const ctx = { jobId: "j", userId: "u1", attempt: 1, now };

function toolInput(fixtureCase: string): unknown {
  const body = loadFixture("exercise-generator", fixtureCase).exchanges[0]?.body as { content: { type: string; input?: unknown }[] };
  return body.content.find((block) => block.type === "tool_use")?.input;
}

function splitterFor(fixtureCase: string) {
  const replay = replayFetch(loadFixture("exercise-generator", fixtureCase));
  return { splitter: new ClaudeItemSplitter(createLanguageModel({ apiKey: "k", fetch: replay.fetch })), requests: replay.requests };
}

// Each type answered by its own recording, as the generation job asks.
function recordedGenerator(): ExerciseGenerator & { requests: number } {
  const generator = {
    requests: 0,
    generate: (input: Parameters<ExerciseGenerator["generate"]>[0]) => {
      const replay = replayFetch(loadFixture("exercise-generator", `generate-${input.type}`));
      const fetch: typeof globalThis.fetch = (url, init) => {
        generator.requests++;
        return replay.fetch(url, init);
      };
      return new ClaudeExerciseGenerator(createLanguageModel({ apiKey: "k", fetch })).generate(input);
    },
  };
  return generator;
}

// The course text each split was recorded on (the fixture's `source`).
function sourceMarkdown(ingestionCase: "legible" | "legible-short"): string {
  const body = loadFixture("ingestion", ingestionCase).exchanges.at(-1)?.body as { content: { type: string; input?: { markdown: string } }[] };
  const markdown = body.content.find((block) => block.type === "tool_use")?.input?.markdown;
  if (markdown === undefined) throw new Error(`no markdown in ingestion/${ingestionCase}`);
  return markdown;
}

describe(`ClaudeItemSplitter contract (${FIXTURE_SOURCE} fixtures)`, () => {
  it("split: at least 8 valid items, each typed from the closed list of seven, in one call", async () => {
    const { splitter, requests } = splitterFor("split");

    const result = await splitter.split({ markdown: sourceMarkdown("legible"), grade: "CE2" });

    if (!result.ok) throw new Error(result.error.message);
    expect(requests).toHaveLength(1);
    const items = validItems(result.value);
    expect(items.length).toBeGreaterThanOrEqual(COVERAGE_MIN_ITEMS);
    for (const item of items) for (const type of item.applicableGameTypes) expect(GAME_TYPES).toContain(type);
  });

  it("a real answer with its items array sent as a JSON string is repaired, without a retry", async () => {
    expect(typeof (toolInput("split-short") as { items: unknown }).items).toBe("string");
    const { splitter, requests } = splitterFor("split-short");

    const result = await splitter.split({ markdown: sourceMarkdown("legible-short"), grade: "CE2" });

    expect(result.ok).toBe(true);
    expect(requests).toHaveLength(1);
  });

  it("an unreadable answer is retried exactly once, with the error sent back, then fails", async () => {
    const { splitter, requests } = splitterFor("schema-violation");

    const result = await splitter.split({ markdown: sourceMarkdown("legible"), grade: "CE2" });

    expect(result.ok).toBe(false);
    expect(requests).toHaveLength(2);
    expect(JSON.stringify(requests[1]?.messages)).toContain("n'a pas respecté le format attendu");
  });
});

describe(`ClaudeExerciseGenerator contract (${FIXTURE_SOURCE} fixtures)`, () => {
  it("real answers with their exercises sent as a JSON string are repaired, one call per type", async () => {
    const { splitter } = splitterFor("split");
    const split = await splitter.split({ markdown: "", grade: "CE2" });
    if (!split.ok) throw new Error(split.error.message);
    const items = validItems(split.value).filter((item) => item.applicableGameTypes.includes("cloze"));
    expect(typeof (toolInput("generate-cloze") as { exercises: unknown }).exercises).toBe("string");
    const generator = recordedGenerator();

    const result = await generator.generate({ type: "cloze", items, courseMarkdown: sourceMarkdown("legible"), grade: "CE2" });

    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.length).toBeGreaterThan(0);
    expect(generator.requests).toBe(1);
  });
});

// Acceptance criterion (docs/jalons.md, M3, "Contrat").
describe("generation jobs on recorded answers", () => {
  it("a lesson with fewer than 8 items ends the generation as insufficient coverage: no game job, a status the screen explains", async () => {
    const repo = fakeItemRepository();
    const jobQueue = fakeJobQueue();
    const deps = { courses: courseTexts({ c1: sourceMarkdown("legible-short") }), splitter: splitterFor("split-short").splitter, repo, jobQueue, idGenerator: sequentialIds() };

    expect((await handleSplittingJob(deps, { courseId: "c1" }, ctx)).ok).toBe(true);

    expect(repo.outcomes.get("u1/c1")?.outcome).toBe("insufficient_coverage");
    expect(repo.items).toEqual([]);
    expect(jobQueue.rows.filter((row) => row.type === GENERATE_EXERCISES_JOB)).toEqual([]);
    expect((await getGenerationStatus({ repo, jobQueue }, "u1", "c1")).status).toBe("insufficient_coverage");
  });

  it("a lesson with at least 8 items gets exercises in at least two different game types", async () => {
    const repo = fakeItemRepository();
    const jobQueue = fakeJobQueue();
    const courses = courseTexts({ c1: sourceMarkdown("legible") });
    const idGenerator = sequentialIds();
    await handleSplittingJob({ courses, splitter: splitterFor("split").splitter, repo, jobQueue, idGenerator }, { courseId: "c1" }, ctx);
    const typeJobs = jobQueue.rows.filter((row) => row.type === GENERATE_EXERCISES_JOB);
    expect(typeJobs.length).toBeGreaterThanOrEqual(2);

    const generator = recordedGenerator();
    for (const job of typeJobs) expect((await handleGenerationJob({ courses, generator, repo, idGenerator }, job.payload as GenerateExercisesPayload, ctx)).ok).toBe(true);

    expect(new Set(repo.exercises.map((exercise) => exercise.type)).size).toBeGreaterThanOrEqual(2);
    expect(generator.requests).toBe(typeJobs.length);
  });
});
