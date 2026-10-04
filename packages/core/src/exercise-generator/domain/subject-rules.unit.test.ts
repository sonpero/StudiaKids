import { describe, expect, it } from "vitest";
import { isGameTypeAllowed, isNumberOrCalculation, subjectProblem } from "./subject-rules.js";

// docs/modules/exercise-generator.md, "Règles par matière": whatever the
// model sends, an exercise forbidden for the course's subject is dropped.
describe("isNumberOrCalculation", () => {
  it("a number, in digits or in words, or a calculation", () => {
    for (const element of ["56", "1 000", "8 352", "3,5", "7 × 8 = 56", "8 × 2", "3 x 4 = 12", "45 + 12", "100 − 1", "12 : 3", "trois", "quatre-vingt-dix", "deux fois trois", "1/2"]) {
      expect(isNumberOrCalculation(element), element).toBe(true);
    }
  });

  it("never a step, a date with its event, or a word", () => {
    for (const element of ["Aligne les unités", "1789 : la Révolution", "Poser 345 + 128 en colonnes", "la dizaine", "plus", "Hier, Léa chantait", "", "="]) {
      expect(isNumberOrCalculation(element), element).toBe(false);
    }
  });
});

describe("isGameTypeAllowed", () => {
  it("maths works on calculation, not spelling: no delayed copy", () => {
    expect(isGameTypeAllowed("maths", "delayed_copy")).toBe(false);
    for (const type of ["mental_math", "mcq", "true_false", "matching", "cloze", "reordering"] as const) expect(isGameTypeAllowed("maths", type), type).toBe(true);
  });

  it("every other subject, or none, keeps all seven types", () => {
    for (const subject of ["french", "history", "other", null] as const) expect(isGameTypeAllowed(subject, "delayed_copy")).toBe(true);
  });
});

describe("subjectProblem", () => {
  it("never a reordering of a times table, of calculations or of numbers, in any subject", () => {
    const table = { type: "reordering" as const, elements: ["7 × 1 = 7", "7 × 2 = 14", "7 × 3 = 21"] };
    expect(subjectProblem("maths", table)).not.toBeNull();
    expect(subjectProblem("history", { type: "reordering", elements: ["1515", "1789", "1848"] })).not.toBeNull();
    expect(subjectProblem(null, { type: "reordering", elements: ["un", "deux", "trois"] })).not.toBeNull();
    // One number among the elements is enough.
    expect(subjectProblem("maths", { type: "reordering", elements: ["J'aligne les unités", "12", "J'additionne les dizaines"] })).not.toBeNull();
  });

  it("a reordering of steps or of dated events stays", () => {
    expect(subjectProblem("maths", { type: "reordering", elements: ["J'aligne les unités", "J'additionne les unités", "J'additionne les dizaines"] })).toBeNull();
    expect(subjectProblem("history", { type: "reordering", elements: ["1515 : Marignan", "1789 : la Révolution", "1848 : le suffrage universel"] })).toBeNull();
  });

  it("maths: never a delayed copy", () => {
    expect(subjectProblem("maths", { type: "delayed_copy", wordOrPhrase: "addition" })).not.toBeNull();
    expect(subjectProblem("french", { type: "delayed_copy", wordOrPhrase: "addition" })).toBeNull();
  });

  it("maths: a cloze's blanks are numbers, never a vocabulary word", () => {
    expect(subjectProblem("maths", { type: "cloze", text: "7 × 8 = {{0}}", blanks: ["56"] })).toBeNull();
    expect(subjectProblem("maths", { type: "cloze", text: "8 352 = {{0}} + 352", blanks: ["8 000"] })).toBeNull();
    expect(subjectProblem("maths", { type: "cloze", text: "La moitié de 7 est {{0}}.", blanks: ["3,5"] })).toBeNull();
    expect(subjectProblem("maths", { type: "cloze", text: "Un million s'écrit {{0}}.", blanks: ["1 000 000"] })).toBeNull();
    expect(subjectProblem("maths", { type: "cloze", text: "Trois quarts s'écrit {{0}}.", blanks: ["3/4"] })).toBeNull();
    expect(subjectProblem("maths", { type: "cloze", text: "Le résultat d'une addition est la {{0}}.", blanks: ["somme"] })).not.toBeNull();
    // A number in words is spelling, not calculation.
    expect(subjectProblem("maths", { type: "cloze", text: "6 + 6 = {{0}}", blanks: ["douze"] })).not.toBeNull();
    // One word blank among number blanks is enough.
    expect(subjectProblem("maths", { type: "cloze", text: "{{0}} + 2 = 5, c'est une {{1}}.", blanks: ["3", "addition"] })).not.toBeNull();
    expect(subjectProblem("french", { type: "cloze", text: "Le {{0}} chante.", blanks: ["merle"] })).toBeNull();
  });

  it("maths: calculation, multiple choice, true or false and matching stay", () => {
    expect(subjectProblem("maths", { type: "mental_math", question: "8 + 5", answer: 13 })).toBeNull();
    expect(subjectProblem("maths", { type: "mcq", question: "7 × 8 ?", options: ["54", "56", "58", "64"], answer: "56" })).toBeNull();
    expect(subjectProblem("maths", { type: "true_false", statement: "7 × 8 = 56", answer: true })).toBeNull();
    expect(subjectProblem("maths", { type: "matching", pairs: [{ left: "7 × 8", right: "56" }, { left: "6 × 6", right: "36" }, { left: "9 × 9", right: "81" }] })).toBeNull();
  });
});
