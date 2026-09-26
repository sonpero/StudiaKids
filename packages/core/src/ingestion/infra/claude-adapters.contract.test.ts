import { describe, expect, it } from "vitest";
import { FIXTURE_SOURCE, loadFixture, replayFetch } from "../../../../../tests/support/llm-fixtures.js";
import { createLanguageModel } from "../../shared/index.js";
import { ClaudeCourseNamer } from "./claude-course-namer.js";
import { ClaudePhotoExtractor } from "./claude-photo-extractor.js";

// Contract tests: raw Messages API responses replayed through the real
// adapters, Zod validation and retry path included. While FIXTURE_SOURCE is
// "synthetic" they validate the wiring, not the model's format
// (docs/modules/ingestion.md); they are rebranched on recorded fixtures
// before A2 can be checked.
const photo = Uint8Array.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x03, 0x00, 0xff, 0xd9]);

function extractorFor(fixtureCase: string) {
  const replay = replayFetch(loadFixture("ingestion", fixtureCase));
  return { extractor: new ClaudePhotoExtractor(createLanguageModel({ apiKey: "k", fetch: replay.fetch })), requests: replay.requests };
}

describe(`ClaudePhotoExtractor contract (${FIXTURE_SOURCE} fixtures)`, () => {
  it("fixtures are what they claim to be", () => {
    for (const fixtureCase of ["legible", "illegible", "not-a-course", "schema-violation"]) {
      expect(loadFixture("ingestion", fixtureCase).synthetic === true).toBe(FIXTURE_SOURCE === "synthetic");
    }
  });

  it("legible: returns Markdown that keeps a heading hierarchy (# then ##)", async () => {
    const { extractor, requests } = extractorFor("legible");

    const result = await extractor.extract({ bytes: photo });

    expect(requests).toHaveLength(1);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value).toMatchObject({ legible: true, isCoursePage: true });
    expect(result.value.markdown).toMatch(/^# \S/m);
    expect(result.value.markdown).toMatch(/^## \S/m);
  });

  it("illegible: legible false with a reason, and no transcription", async () => {
    const result = await extractorFor("illegible").extractor.extract({ bytes: photo });

    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.legible).toBe(false);
    expect(result.value.reason?.trim().length).toBeGreaterThan(0);
  });

  it("not a course page: legible, isCoursePage false, with a reason", async () => {
    const result = await extractorFor("not-a-course").extractor.extract({ bytes: photo });

    if (!result.ok) throw new Error(result.error.message);
    expect(result.value).toMatchObject({ legible: true, isCoursePage: false });
    expect(result.value.reason?.trim().length).toBeGreaterThan(0);
  });

  it("a response violating the schema triggers exactly one retry, then a failure", async () => {
    const { extractor, requests } = extractorFor("schema-violation");

    const result = await extractor.extract({ bytes: photo });

    expect(result.ok).toBe(false);
    expect(requests).toHaveLength(2);
    expect(JSON.stringify(requests[1]?.messages)).toContain("n'a pas respecté le format attendu");
  });
});

describe(`ClaudeCourseNamer contract (${FIXTURE_SOURCE} fixtures)`, () => {
  it("proposes a title of 3 to 60 characters, not led by a lesson code, and a subject from the closed list", async () => {
    const replay = replayFetch(loadFixture("ingestion", "namer"));
    const namer = new ClaudeCourseNamer(createLanguageModel({ apiKey: "k", fetch: replay.fetch }));

    const result = await namer.suggest({ markdown: "# Les fractions" });

    if (!result.ok) throw new Error(result.error.message);
    const title = result.value.title ?? "";
    expect(result.value.title).not.toBeNull();
    expect(title.trim().length).toBeGreaterThanOrEqual(3);
    expect(title.trim().length).toBeLessThanOrEqual(60);
    expect(title).not.toMatch(/^\s*(NUM|NB|Leçon|Chapitre)\s*\d/i);
    expect(["maths", "french", "history", "geography", "science", "english", "other"]).toContain(result.value.subject);
  });
});
