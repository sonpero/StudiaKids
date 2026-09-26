import { describe, expect, it } from "vitest";
import { parseExercise } from "./exercises.js";

const ok = (type: Parameters<typeof parseExercise>[0], raw: unknown, itemCount = 3) => parseExercise(type, raw, itemCount);

// docs/modules/exercise-generator.md: each exercise is checked on its
// own; an invalid one is dropped alone.
describe("parseExercise", () => {
  it("names the item by its number in the list given, and refuses one outside it", () => {
    expect(ok("true_false", { item: 2, statement: "s", answer: true })).toEqual({ ok: true, value: { item: 2, content: { type: "true_false", statement: "s", answer: true } } });
    expect(ok("true_false", { item: 3, statement: "s", answer: true }).ok).toBe(false);
    expect(ok("true_false", { item: -1, statement: "s", answer: true }).ok).toBe(false);
    expect(ok("true_false", { item: 1.5, statement: "s", answer: true }).ok).toBe(false);
  });

  it("mcq: exactly 4 distinct options, the answer among them", () => {
    const mcq = (options: string[], answer: string) => ok("mcq", { item: 0, question: "Q ?", options, answer });
    expect(mcq(["a", "b", "c", "d"], "b").ok).toBe(true);
    expect(mcq(["a", "b", "c"], "b").ok).toBe(false);
    expect(mcq(["a", "b", "c", "d", "e"], "b").ok).toBe(false);
    expect(mcq(["a", "b", "c", "c"], "c").ok).toBe(false);
    expect(mcq(["a", "b", "c", "d"], "e").ok).toBe(false);
    // Five options, one of them twice: four distinct values, still not 4 options.
    expect(mcq(["a", "b", "c", "d", "d"], "b").ok).toBe(false);
  });

  it("cloze: as many {{n}} blanks, numbered from 0, as expected answers", () => {
    expect(ok("cloze", { item: 0, text: "Le {{0}} change avec le {{1}}.", blanks: ["verbe", "temps"] }).ok).toBe(true);
    expect(ok("cloze", { item: 0, text: "Le {{0}} change.", blanks: ["verbe", "temps"] }).ok).toBe(false);
    expect(ok("cloze", { item: 0, text: "Le verbe change.", blanks: [] }).ok).toBe(false);
    expect(ok("cloze", { item: 0, text: "Le {{1}} change.", blanks: ["verbe"] }).ok).toBe(false);
  });

  it("matching: 3 to 6 pairs", () => {
    const pairs = (n: number) => Array.from({ length: n }, (_, i) => ({ left: `g${String(i)}`, right: `d${String(i)}` }));
    expect(ok("matching", { item: 0, pairs: pairs(3) }).ok).toBe(true);
    expect(ok("matching", { item: 0, pairs: pairs(6) }).ok).toBe(true);
    expect(ok("matching", { item: 0, pairs: pairs(2) }).ok).toBe(false);
    expect(ok("matching", { item: 0, pairs: pairs(7) }).ok).toBe(false);
  });

  it("reordering: 3 to 6 elements", () => {
    expect(ok("reordering", { item: 0, elements: ["a", "b", "c"] }).ok).toBe(true);
    expect(ok("reordering", { item: 0, elements: ["a", "b"] }).ok).toBe(false);
    expect(ok("reordering", { item: 0, elements: ["a", "b", "c", "d", "e", "f", "g"] }).ok).toBe(false);
  });

  it("delayed_copy: 1 to 6 words", () => {
    expect(ok("delayed_copy", { item: 0, wordOrPhrase: "chanter" }).ok).toBe(true);
    expect(ok("delayed_copy", { item: 0, wordOrPhrase: "un deux trois quatre cinq six" }).ok).toBe(true);
    expect(ok("delayed_copy", { item: 0, wordOrPhrase: "un deux trois quatre cinq six sept" }).ok).toBe(false);
    expect(ok("delayed_copy", { item: 0, wordOrPhrase: "  " }).ok).toBe(false);
  });

  it("mental_math: a number as the answer", () => {
    expect(ok("mental_math", { item: 0, question: "8 000 + 300", answer: 8300 }).ok).toBe(true);
    expect(ok("mental_math", { item: 0, question: "8 000 + 300", answer: "8300" }).ok).toBe(false);
  });

  it("refuses a malformed exercise instead of throwing", () => {
    for (const raw of [null, "x", 3, { item: 0 }, { item: 0, question: 5, options: "abcd", answer: 1 }]) expect(ok("mcq", raw).ok).toBe(false);
  });
});
