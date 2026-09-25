import { describe, expect, it } from "vitest";
import { parseArgs } from "./args.js";

describe("parseArgs", () => {
  it("reads a photo case with its photo", () => {
    expect(parseArgs(["ingestion", "legible", "--photo", "page.jpg"])).toEqual({
      ok: true,
      value: { module: "ingestion", fixtureCase: "legible", photoPath: "page.jpg", force: false, dryRun: false },
    });
  });

  it("reads --force and --dry-run in any order", () => {
    expect(parseArgs(["ingestion", "illegible", "--dry-run", "--photo", "f.jpg", "--force"])).toEqual({
      ok: true,
      value: { module: "ingestion", fixtureCase: "illegible", photoPath: "f.jpg", force: true, dryRun: true },
    });
  });

  it("reads the namer case, which takes no photo", () => {
    expect(parseArgs(["ingestion", "namer", "--dry-run"])).toEqual({
      ok: true,
      value: { module: "ingestion", fixtureCase: "namer", photoPath: null, force: false, dryRun: true },
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
