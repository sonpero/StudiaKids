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
