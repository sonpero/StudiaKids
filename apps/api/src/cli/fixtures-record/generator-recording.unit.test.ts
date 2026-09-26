import { describe, expect, it } from "vitest";
import { buildFixture } from "./recording.js";
import { splitMismatch } from "./generator-recording.js";

describe("splitMismatch", () => {
  it("split needs enough items for games; split-short needs too few", () => {
    expect(splitMismatch("split", 6)).toBeNull();
    expect(splitMismatch("split", 5)).toMatch(/6/);
    expect(splitMismatch("split-short", 5)).toBeNull();
    expect(splitMismatch("split-short", 6)).toMatch(/6/);
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
