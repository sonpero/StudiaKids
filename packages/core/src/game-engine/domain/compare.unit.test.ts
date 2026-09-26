import { describe, expect, it } from "vitest";
import { checkAnswer, compareCloze, compareDelayedCopy, compareMatching, compareMcq, compareMentalMath, compareReordering, compareTrueFalse } from "./compare.js";

// docs/modules/game-engine.md, "Le comparateur": one comparison per type,
// never a global equality; a list of units, one per sub-answer.
const ok = (...ids: string[]) => ({ units: ids.map((id) => ({ id, correct: true })) });
const flags = (result: { units: { correct: boolean }[] }) => result.units.map((unit) => unit.correct);

describe("mcq", () => {
  const content = { type: "mcq" as const, question: "Que fait le verbe ?", options: ["Il indique l'action", "Il nomme", "Il décrit", "Il relie"], answer: "Il indique l'action" };

  it("the right option is correct, another is not", () => {
    expect(compareMcq({ chosenOption: "Il indique l'action" }, content)).toEqual(ok("0"));
    expect(flags(compareMcq({ chosenOption: "Il nomme" }, content))).toEqual([false]);
  });

  it("the option's place in the list does not matter, only which one is chosen", () => {
    expect(compareMcq({ chosenOption: "Il indique l'action" }, { ...content, options: ["Il nomme", "Il décrit", "Il relie", "Il indique l'action"] })).toEqual(ok("0"));
  });
});

describe("true_false", () => {
  it("agreeing with the statement's truth is correct, disagreeing is not", () => {
    expect(compareTrueFalse({ value: true }, { type: "true_false", statement: "Le verbe change avec le temps.", answer: true })).toEqual(ok("0"));
    expect(flags(compareTrueFalse({ value: false }, { type: "true_false", statement: "Le verbe change avec le temps.", answer: true }))).toEqual([false]);
  });

  it("a false statement answered « faux » is correct: it judges agreement, not the value", () => {
    expect(compareTrueFalse({ value: false }, { type: "true_false", statement: "L'infinitif change.", answer: false })).toEqual(ok("0"));
    expect(flags(compareTrueFalse({ value: true }, { type: "true_false", statement: "L'infinitif change.", answer: false }))).toEqual([false]);
  });
});

describe("mental_math", () => {
  const content = { type: "mental_math" as const, question: "4 × 7", answer: 28 };

  it("the right number is correct, another is not", () => {
    expect(compareMentalMath({ value: "28" }, content)).toEqual(ok("0"));
    expect(flags(compareMentalMath({ value: "27" }, content))).toEqual([false]);
  });

  it("spaces, a digit-group space and a decimal comma do not matter (à valider)", () => {
    expect(compareMentalMath({ value: " 28 " }, content)).toEqual(ok("0"));
    expect(compareMentalMath({ value: "1 000" }, { ...content, answer: 1000 })).toEqual(ok("0"));
    expect(compareMentalMath({ value: "1\u00a0000" }, { ...content, answer: 1000 })).toEqual(ok("0"));
    expect(compareMentalMath({ value: "1\u202f000" }, { ...content, answer: 1000 })).toEqual(ok("0"));
    expect(compareMentalMath({ value: "2,5" }, { ...content, answer: 2.5 })).toEqual(ok("0"));
    expect(compareMentalMath({ value: "2.50" }, { ...content, answer: 2.5 })).toEqual(ok("0"));
    expect(compareMentalMath({ value: "-3" }, { ...content, answer: -3 })).toEqual(ok("0"));
  });

  it("a non-numeric answer is incorrect, never an exception", () => {
    for (const value of ["", "vingt-huit", "28 ans", "2 8a", "1e3", "Infinity", "0x1C", "--28", "28,"]) {
      expect(flags(compareMentalMath({ value }, content)), value).toEqual([false]);
    }
    // Scientific notation is not a primary school answer, even when it is worth the result.
    for (const value of ["1e1", "+10", ".10e2"]) {
      expect(flags(compareMentalMath({ value }, { ...content, answer: 10 })), value).toEqual([false]);
    }
  });
});

describe("delayed_copy", () => {
  const content = { type: "delayed_copy" as const, wordOrPhrase: "l'infinitif" };

  it("the exact word is correct, a misspelling is not", () => {
    expect(compareDelayedCopy({ text: "l'infinitif" }, content)).toEqual(ok("0"));
    expect(flags(compareDelayedCopy({ text: "l'infinitive" }, content))).toEqual([false]);
  });

  it("spaces around, and a phone's typographic apostrophe, do not matter", () => {
    expect(compareDelayedCopy({ text: "  l'infinitif " }, content)).toEqual(ok("0"));
    expect(compareDelayedCopy({ text: "l’infinitif" }, content)).toEqual(ok("0"));
  });

  it("is exact on case and accents, where cloze is tolerant: they never share a normalisation", () => {
    expect(flags(compareDelayedCopy({ text: "L'infinitif" }, content))).toEqual([false]);
    expect(flags(compareDelayedCopy({ text: "chantera" }, { type: "delayed_copy", wordOrPhrase: "chanterà" }))).toEqual([false]);
    expect(flags(compareDelayedCopy({ text: "leve" }, { type: "delayed_copy", wordOrPhrase: "lève" }))).toEqual([false]);
    expect(flags(compareDelayedCopy({ text: "Léa  chante" }, { type: "delayed_copy", wordOrPhrase: "Léa chante" }))).toEqual([false]);
    expect(compareCloze({ values: ["LEVE"] }, { type: "cloze", text: "Il se {{0}}.", blanks: ["lève"] })).toEqual(ok("0"));
  });
});

describe("cloze", () => {
  const content = { type: "cloze" as const, text: "Hier, Léa {{0}}. Demain, Léa {{1}}.", blanks: ["chantait", "chantera"] };

  it("one unit per blank: right values are correct, a wrong one only fails its own blank", () => {
    expect(compareCloze({ values: ["chantait", "chantera"] }, content)).toEqual(ok("0", "1"));
    expect(flags(compareCloze({ values: ["chante", "chantera"] }, content))).toEqual([false, true]);
  });

  it("case, accents, extra spaces, the apostrophe and a final punctuation mark do not matter", () => {
    expect(compareCloze({ values: ["  CHANTAIT ", "chanterà."] }, content)).toEqual(ok("0", "1"));
    expect(compareCloze({ values: ["l’infinitif"] }, { type: "cloze", text: "C'est {{0}}.", blanks: ["l'infinitif"] })).toEqual(ok("0"));
    expect(compareCloze({ values: ["dioxyde  de   carbone !"] }, { type: "cloze", text: "Il prend du {{0}}.", blanks: ["dioxyde de carbone"] })).toEqual(ok("0"));
  });

  it("spelling still counts, and a missing value is incorrect", () => {
    expect(flags(compareCloze({ values: ["chantàit", "chanteras"] }, content))).toEqual([true, false]);
    expect(flags(compareCloze({ values: ["chantait"] }, content))).toEqual([true, false]);
    expect(flags(compareCloze({ values: ["chantera", "chantait"] }, content))).toEqual([false, false]);
  });
});

describe("matching", () => {
  const content = {
    type: "matching" as const,
    pairs: [
      { left: "Hier", right: "Léa chantait" },
      { left: "Aujourd'hui", right: "Léa chante" },
      { left: "Demain", right: "Léa chantera" },
    ],
  };

  it("one unit per expected pair: right pairs are correct, a swapped pair fails its two lefts only", () => {
    expect(compareMatching({ pairs: content.pairs }, content)).toEqual(ok("0", "1", "2"));
    const swapped = [
      { left: "Hier", right: "Léa chante" },
      { left: "Aujourd'hui", right: "Léa chantait" },
      { left: "Demain", right: "Léa chantera" },
    ];
    expect(flags(compareMatching({ pairs: swapped }, content))).toEqual([false, false, true]);
  });

  it("the order in which the pairs are given does not matter", () => {
    expect(compareMatching({ pairs: [...content.pairs].reverse() }, content)).toEqual(ok("0", "1", "2"));
  });

  it("a pair left out is incorrect; an unknown left is ignored; the first pairing of a left counts", () => {
    expect(flags(compareMatching({ pairs: content.pairs.slice(0, 2) }, content))).toEqual([true, true, false]);
    expect(compareMatching({ pairs: [...content.pairs, { left: "Jamais", right: "x" }] }, content)).toEqual(ok("0", "1", "2"));
    expect(flags(compareMatching({ pairs: [{ left: "Hier", right: "x" }, ...content.pairs] }, content))).toEqual([false, true, true]);
  });
});

describe("reordering", () => {
  const content = { type: "reordering" as const, elements: ["hier", "aujourd'hui", "demain", "après-demain"] };

  it("one unit per position: the right order is correct, a wrong one is not", () => {
    expect(compareReordering({ order: content.elements }, content)).toEqual(ok("0", "1", "2", "3"));
    expect(flags(compareReordering({ order: [...content.elements].reverse() }, content))).toEqual([false, false, false, false]);
  });

  it("two adjacent elements swapped do not make the other positions incorrect", () => {
    expect(flags(compareReordering({ order: ["aujourd'hui", "hier", "demain", "après-demain"] }, content))).toEqual([false, false, true, true]);
  });

  it("a position left empty is incorrect", () => {
    expect(flags(compareReordering({ order: ["hier", "aujourd'hui"] }, content))).toEqual([true, true, false, false]);
  });
});

describe("checkAnswer", () => {
  it("reads the answer for the exercise's own type, then compares it", () => {
    expect(checkAnswer({ type: "true_false", statement: "Vrai.", answer: true }, { value: true })).toEqual({ ok: true, value: ok("0") });
    expect(checkAnswer({ type: "reordering", elements: ["a", "b", "c"] }, { order: ["a", "b", "c"] })).toEqual({ ok: true, value: ok("0", "1", "2") });
    expect(checkAnswer({ type: "matching", pairs: [{ left: "a", right: "b" }] }, { pairs: [{ left: "a", right: "b" }] })).toEqual({ ok: true, value: ok("0") });
  });

  it("refuses an answer shaped for another type, or malformed, as invalid — never an exception", () => {
    const invalid = { ok: false, error: "invalid-answer" };
    expect(checkAnswer({ type: "true_false", statement: "Vrai.", answer: true }, { value: "vrai" })).toEqual(invalid);
    expect(checkAnswer({ type: "mental_math", question: "1 + 1", answer: 2 }, { value: 2 })).toEqual(invalid);
    expect(checkAnswer({ type: "cloze", text: "{{0}}", blanks: ["a"] }, { values: ["a", 3] })).toEqual(invalid);
    expect(checkAnswer({ type: "matching", pairs: [{ left: "a", right: "b" }] }, { pairs: [{ left: "a" }] })).toEqual(invalid);
    expect(checkAnswer({ type: "matching", pairs: [{ left: "a", right: "b" }] }, { pairs: [{ right: "b" }] })).toEqual(invalid);
    expect(checkAnswer({ type: "reordering", elements: ["a"] }, { order: "a" })).toEqual(invalid);
    expect(checkAnswer({ type: "mcq", question: "?", options: ["a", "b", "c", "d"], answer: "a" }, null)).toEqual(invalid);
    expect(checkAnswer({ type: "delayed_copy", wordOrPhrase: "a" }, { text: ["a"] })).toEqual(invalid);
    expect(checkAnswer({ type: "delayed_copy", wordOrPhrase: "a" }, "a")).toEqual(invalid);
  });
});
