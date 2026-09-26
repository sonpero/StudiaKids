import { describe, expect, it } from "vitest";
import { needsRegeneration } from "./regeneration.js";

// docs/modules/exercise-generator.md: a type is regenerated once if fewer
// than half the exercises asked are valid, or none is.
describe("needsRegeneration", () => {
  it("regenerates below half, not at half or above", () => {
    expect(needsRegeneration(10, 4)).toBe(true);
    expect(needsRegeneration(10, 5)).toBe(false);
    expect(needsRegeneration(10, 10)).toBe(false);
    expect(needsRegeneration(3, 1)).toBe(true);
    expect(needsRegeneration(3, 2)).toBe(false);
  });

  it("always regenerates when none is valid, even for a single item", () => {
    expect(needsRegeneration(1, 0)).toBe(true);
    expect(needsRegeneration(1, 1)).toBe(false);
  });

  it("never regenerates a type nothing was asked of", () => {
    expect(needsRegeneration(0, 0)).toBe(false);
  });
});
