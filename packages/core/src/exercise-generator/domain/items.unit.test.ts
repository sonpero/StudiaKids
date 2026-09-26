import { describe, expect, it } from "vitest";
import { GAME_TYPES } from "./game-types.js";
import { COVERAGE_MAX_ITEMS, COVERAGE_MIN_ITEMS, coverageOutcome, ITEM_MAX_GAME_TYPES, validItems } from "./items.js";

const proposal = (title: string, applicableGameTypes: string[] = ["mcq"], body = `Le corps de ${title}.`) => ({ title, body, applicableGameTypes });
const many = (n: number) => Array.from({ length: n }, (_, i) => proposal(`Item numéro ${String(i)}`));

describe("game types", () => {
  it("are the closed list of game-engine.md", () => {
    expect(GAME_TYPES).toEqual(["delayed_copy", "mcq", "matching", "reordering", "cloze", "true_false", "mental_math"]);
  });
});

// Acceptance (docs/jalons.md, M3): the coverage check triggers exactly
// below 8 items, never at 8 or above.
describe("coverageOutcome", () => {
  it("is insufficient at 7 items, ready at 8", () => {
    expect(COVERAGE_MIN_ITEMS).toBe(8);
    expect(coverageOutcome(7)).toBe("insufficient_coverage");
    expect(coverageOutcome(8)).toBe("items_ready");
    expect(coverageOutcome(0)).toBe("insufficient_coverage");
    expect(coverageOutcome(40)).toBe("items_ready");
  });
});

describe("validItems", () => {
  // Acceptance (docs/jalons.md, M3): the annotation can only produce
  // values of the closed list of seven types.
  it("keeps only the closed list's game types, in order, at most 3, never twice", () => {
    expect(ITEM_MAX_GAME_TYPES).toBe(3);
    const [item] = validItems([proposal("Le verbe", ["quiz", "mcq", "cloze", "mcq", "true_false", "matching"])]);
    expect(item?.applicableGameTypes).toEqual(["mcq", "cloze", "true_false"]);
  });

  it("drops an item left with no known game type", () => {
    expect(validItems([proposal("Le verbe", ["quiz", "puzzle"]), proposal("Le sujet")]).map((i) => i.title)).toEqual(["Le sujet"]);
  });

  it("drops an item whose title is not 3 to 60 characters, or whose body is empty", () => {
    const kept = validItems([proposal("Ab"), proposal("x".repeat(61)), proposal("Le verbe", ["mcq"], "   "), proposal("Abc"), proposal("y".repeat(60))]);
    expect(kept.map((i) => i.title.length)).toEqual([3, 60]);
  });

  it("drops a title already used in the course, whatever its case or spaces", () => {
    expect(validItems([proposal("Le verbe"), proposal("  le VERBE "), proposal("Le sujet")]).map((i) => i.title)).toEqual(["Le verbe", "Le sujet"]);
  });

  it("numbers positions contiguously from 0, after drops", () => {
    expect(validItems([proposal("Une"), proposal("A"), proposal("Deux"), proposal("Trois")]).map((i) => i.position)).toEqual([0, 1, 2]);
  });

  it("keeps the first 40 items of a longer split", () => {
    expect(COVERAGE_MAX_ITEMS).toBe(40);
    const kept = validItems(many(41));
    expect(kept).toHaveLength(40);
    expect(kept[39]?.title).toBe("Item numéro 39");
  });

  it("trims titles and bodies", () => {
    expect(validItems([proposal("  Le verbe  ", ["mcq"], "  Texte.  ")])[0]).toMatchObject({ title: "Le verbe", body: "Texte." });
  });
});
