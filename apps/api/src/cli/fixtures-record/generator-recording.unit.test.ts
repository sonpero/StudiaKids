import { describe, expect, it } from "vitest";
import { buildFixture } from "./recording.js";
import { splitMismatch } from "./generator-recording.js";

describe("splitMismatch", () => {
  it("split needs enough items for games; split-short needs too few", () => {
    expect(splitMismatch("split", 8)).toBeNull();
    expect(splitMismatch("split", 7)).toMatch(/8/);
    expect(splitMismatch("split-short", 7)).toBeNull();
    expect(splitMismatch("split-short", 8)).toMatch(/8/);
  });
});

describe("buildFixture, with the fixture its input came from", () => {
  it("names the source, since the request body is never written", () => {
    expect(buildFixture({ module: "exercise-generator", fixtureCase: "split", model: "m", recordedAt: "2026-09-26T10:00:00.000Z", source: "ingestion/legible.json", exchanges: [] })).toEqual({
      module: "exercise-generator",
      case: "split",
      model: "m",
      recordedAt: "2026-09-26T10:00:00.000Z",
      source: "ingestion/legible.json",
      exchanges: [],
    });
  });
});
