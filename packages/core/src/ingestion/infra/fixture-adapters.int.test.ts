import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FixtureCourseNamer, FixturePhotoExtractor } from "./fixture-adapters.js";

const fixturesDir = fileURLToPath(new URL("../../../../../tests/fixtures/ingestion/synthetic", import.meta.url));
const photo = (fixtureCase: string) => new Uint8Array(readFileSync(`${fixturesDir}/photos/${fixtureCase}.jpg`));

// The fixture adapters stand in for the model in the worker when
// LLM_ADAPTER=fixture: the photo's SHA-256 picks the recorded answer.
describe("FixturePhotoExtractor", () => {
  const extractor = new FixturePhotoExtractor(fixturesDir);

  it("answers the legible fixture for the legible photo, with a heading hierarchy", async () => {
    const result = await extractor.extract({ bytes: photo("legible") });

    if (!result.ok) throw new Error(result.error.message);
    expect(result.value).toMatchObject({ legible: true, isCoursePage: true });
    expect(result.value.markdown).toMatch(/^# \S/m);
  });

  it("answers illegible, with a reason, for the blurred photo", async () => {
    const result = await extractor.extract({ bytes: photo("illegible") });

    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.legible).toBe(false);
    expect(result.value.reason?.length).toBeGreaterThan(0);
  });

  it("answers not a course page for the photo with no lesson", async () => {
    const result = await extractor.extract({ bytes: photo("not-a-course") });

    if (!result.ok) throw new Error(result.error.message);
    expect(result.value).toMatchObject({ legible: true, isCoursePage: false });
  });

  it("fails loudly on a photo it has no fixture for, rather than inventing an answer", async () => {
    const result = await extractor.extract({ bytes: Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]) });

    expect(result).toMatchObject({ ok: false, error: { kind: "model-error" } });
    if (!result.ok) expect(result.error.message).toMatch(/no fixture/i);
  });
});

describe("FixtureCourseNamer", () => {
  it("answers the namer fixture's title and subject", async () => {
    const result = await new FixtureCourseNamer(fixturesDir).suggest({ markdown: "# Le verbe" });

    expect(result).toEqual({ ok: true, value: { title: "Le verbe", subject: "french" } });
  });
});
