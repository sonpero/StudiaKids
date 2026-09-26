import { describe, expect, it } from "vitest";
import { parseArgs } from "./args.js";

describe("parseArgs", () => {
  it("reads a photo case with its photo", () => {
    expect(parseArgs(["ingestion", "legible", "--photo", "page.jpg"])).toEqual({
      ok: true,
      value: { module: "ingestion", fixtureCase: "legible", photoPath: "page.jpg", force: false, dryRun: false, show: false },
    });
  });

  it("reads --force and --dry-run in any order", () => {
    expect(parseArgs(["ingestion", "illegible", "--dry-run", "--photo", "f.jpg", "--force"])).toEqual({
      ok: true,
      value: { module: "ingestion", fixtureCase: "illegible", photoPath: "f.jpg", force: true, dryRun: true, show: false },
    });
  });

  it("reads the namer case, which takes no photo", () => {
    expect(parseArgs(["ingestion", "namer", "--dry-run"])).toEqual({
      ok: true,
      value: { module: "ingestion", fixtureCase: "namer", photoPath: null, force: false, dryRun: true, show: false },
    });
  });

  it("reads --show", () => {
    expect(parseArgs(["ingestion", "legible", "--dry-run", "--show", "--photo", "p.jpg"])).toEqual({
      ok: true,
      value: { module: "ingestion", fixtureCase: "legible", photoPath: "p.jpg", force: false, dryRun: true, show: true },
    });
  });

  it("refuses an unknown module or case, a photo case without its photo, and an unknown option", () => {
    expect(parseArgs(["reader", "legible", "--photo", "p.jpg"]).ok).toBe(false);
    expect(parseArgs(["ingestion", "blurry", "--photo", "p.jpg"]).ok).toBe(false);
    expect(parseArgs(["ingestion", "legible"]).ok).toBe(false);
    expect(parseArgs(["ingestion", "legible", "--photo"]).ok).toBe(false);
    expect(parseArgs(["ingestion", "legible", "--photo", "p.jpg", "--dryrun"]).ok).toBe(false);
    expect(parseArgs([]).ok).toBe(false);
  });
});

// Decided at M2 (2026-09-26): a namer fixture on a real lesson's long
// title, named from a generated page's extraction.
describe("parseArgs, namer-long-title", () => {
  it("reads the case with the page to extract and name", () => {
    expect(parseArgs(["ingestion", "namer-long-title", "--photo", "page.jpg", "--dry-run"])).toEqual({
      ok: true,
      value: { module: "ingestion", fixtureCase: "namer-long-title", photoPath: "page.jpg", force: false, dryRun: true, show: false },
    });
  });

  it("refuses it without its page", () => {
    expect(parseArgs(["ingestion", "namer-long-title"]).ok).toBe(false);
  });
});

// M3: a short lesson's page, and the splitting and generation answers the
// worker replays in LLM_ADAPTER=fixture.
describe("parseArgs, M3 cases", () => {
  it("reads the short lesson's photo case", () => {
    expect(parseArgs(["ingestion", "legible-short", "--photo", "short.jpg"])).toEqual({
      ok: true,
      value: { module: "ingestion", fixtureCase: "legible-short", photoPath: "short.jpg", force: false, dryRun: false, show: false },
    });
  });

  it("reads the exercise-generator cases, which take no photo", () => {
    for (const fixtureCase of ["split", "split-short", "generate"]) {
      expect(parseArgs(["exercise-generator", fixtureCase, "--force"])).toEqual({
        ok: true,
        value: { module: "exercise-generator", fixtureCase, photoPath: null, force: true, dryRun: false, show: false },
      });
    }
  });

  it("refuses an exercise-generator case with a photo, or an unknown one", () => {
    expect(parseArgs(["exercise-generator", "split", "--photo", "p.jpg"]).ok).toBe(false);
    expect(parseArgs(["exercise-generator", "legible", "--photo", "p.jpg"]).ok).toBe(false);
    expect(parseArgs(["exercise-generator", "namer"]).ok).toBe(false);
  });
});
