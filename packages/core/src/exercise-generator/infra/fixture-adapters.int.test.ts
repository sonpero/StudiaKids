import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { COVERAGE_MIN_ITEMS, validItems } from "../domain/items.js";
import { FixtureExerciseGenerator, FixtureItemSplitter } from "./fixture-adapters.js";

const fixturesRoot = fileURLToPath(new URL("../../../../../tests/fixtures", import.meta.url));

function recordedMarkdown(ingestionCase: string): string {
  const file = JSON.parse(readFileSync(`${fixturesRoot}/ingestion/${ingestionCase}.json`, "utf8")) as { exchanges: { body: { content: { type: string; input?: { markdown?: string } }[] } }[] };
  const markdown = file.exchanges[0]?.body.content.find((block) => block.type === "tool_use")?.input?.markdown;
  if (markdown === undefined) throw new Error(ingestionCase);
  return markdown;
}

// The fixture adapters stand in for the model in the worker when
// LLM_ADAPTER=fixture (e2e): the real adapters, fed the recorded answers,
// so Zod validation and repair run as in production.
describe("FixtureItemSplitter", () => {
  const splitter = new FixtureItemSplitter(fixturesRoot);

  it("answers the recorded split for the text of the recorded legible page", async () => {
    const result = await splitter.split({ markdown: recordedMarkdown("legible"), grade: "CM1" });

    if (!result.ok) throw new Error(result.error.message);
    expect(validItems(result.value).length).toBeGreaterThanOrEqual(COVERAGE_MIN_ITEMS);
  });

  it("answers the short split for the text of the short page", async () => {
    const result = await splitter.split({ markdown: recordedMarkdown("legible-short"), grade: "CP" });

    if (!result.ok) throw new Error(result.error.message);
    expect(validItems(result.value).length).toBeLessThan(COVERAGE_MIN_ITEMS);
  });

  it("recognises a course of several photos of the same page, whose text repeats the page's", async () => {
    const page = recordedMarkdown("legible");

    const result = await splitter.split({ markdown: `${page}\n\n${page}`, grade: "CM1" });

    expect(result.ok).toBe(true);
  });

  it("fails loudly on a text it has no fixture for, rather than inventing items", async () => {
    const result = await splitter.split({ markdown: "# Une leçon jamais enregistrée", grade: "CM1" });

    expect(result).toMatchObject({ ok: false, error: { kind: "model-error" } });
  });
});

describe("FixtureExerciseGenerator", () => {
  const generator = new FixtureExerciseGenerator(fixturesRoot);

  it("answers each recorded type with its recorded exercises, repaired", async () => {
    const split = await new FixtureItemSplitter(fixturesRoot).split({ markdown: recordedMarkdown("legible"), grade: "CM1" });
    if (!split.ok) throw new Error(split.error.message);
    const items = validItems(split.value).filter((item) => item.applicableGameTypes.includes("cloze"));

    const result = await generator.generate({ type: "cloze", items, courseMarkdown: recordedMarkdown("legible"), grade: "CM1" });

    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.length).toBeGreaterThan(0);
  });

  it("fails loudly on a type it has no recording for", async () => {
    const result = await generator.generate({ type: "mental_math", items: [], courseMarkdown: "", grade: "CM1" });

    expect(result).toMatchObject({ ok: false, error: { kind: "model-error" } });
  });
});
