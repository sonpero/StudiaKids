import { describe, expect, it } from "vitest";
import { anchoringProblem } from "./anchoring.js";

const course = `# Le château fort
Il est entouré de hautes murailles et d'un fossé.
- le pont-levis se lève en cas d'attaque ;
- le donjon est la tour la plus haute.
Hier, Léa chantait. Aujourd'hui, Léa chante. Demain, Léa chantera.
8 352 = 8 000 + 300 + 50 + 2 ; on encadre : 4 560 < 4 562 < 4 570.`;

// docs/modules/exercise-generator.md, "Règle d'ancrage": every exercise,
// answer included, must be checkable against the course text.
describe("anchoringProblem", () => {
  it("cloze: every expected answer is in the course, whatever its case or accents", () => {
    expect(anchoringProblem({ type: "cloze", text: "Le {{0}} est la tour la plus haute.", blanks: ["Donjon"] }, course)).toBeNull();
    expect(anchoringProblem({ type: "cloze", text: "Le {{0}} garde le château.", blanks: ["chevalier"] }, course)).not.toBeNull();
    // One answer out of two absent is enough to refuse it.
    expect(anchoringProblem({ type: "cloze", text: "Le {{0}} et le {{1}}.", blanks: ["donjon", "chevalier"] }, course)).not.toBeNull();
  });

  it("delayed_copy: the word or phrase is in the course", () => {
    expect(anchoringProblem({ type: "delayed_copy", wordOrPhrase: "pont-levis" }, course)).toBeNull();
    expect(anchoringProblem({ type: "delayed_copy", wordOrPhrase: "herse" }, course)).not.toBeNull();
  });

  it("reordering: every element is in the course, in the course's own order", () => {
    expect(anchoringProblem({ type: "reordering", elements: ["chantait", "chante.", "chantera"] }, course)).toBeNull();
    // The order invented at M3's dry-run: the course gives no such sequence.
    expect(anchoringProblem({ type: "reordering", elements: ["fossé", "pont-levis", "murailles", "donjon"] }, course)).not.toBeNull();
    expect(anchoringProblem({ type: "reordering", elements: ["chantait", "chante.", "chanteront"] }, course)).not.toBeNull();
    // An absent first element, the rest in order: still refused.
    expect(anchoringProblem({ type: "reordering", elements: ["chanterons", "chante.", "chantera"] }, course)).toMatch(/absent/);
  });

  // Regression (eval v2): « 9 » and « 10 » first appear earlier in the
  // course (9 + 4, 7 + 3 = 10); the sequence itself is written in order.
  it("reordering: elements that also appear earlier still follow the course's own sequence", () => {
    const counting = "9 + 4 = 13. 7 + 3 = 10. Je pars de 8 et j'avance de 5 : 9, 10, 11, 12, 13.";
    expect(anchoringProblem({ type: "reordering", elements: ["9", "10", "11", "12", "13"] }, counting)).toBeNull();
    expect(anchoringProblem({ type: "reordering", elements: ["13", "12", "11"] }, counting)).not.toBeNull();
    expect(anchoringProblem({ type: "reordering", elements: ["8", "8", "9"] }, counting)).not.toBeNull();
  });

  it("matching: both sides of every pair are in the course", () => {
    expect(anchoringProblem({ type: "matching", pairs: [{ left: "le donjon", right: "la tour la plus haute" }, { left: "le pont-levis", right: "se lève en cas d'attaque" }, { left: "murailles", right: "fossé" }] }, course)).toBeNull();
    expect(anchoringProblem({ type: "matching", pairs: [{ left: "le donjon", right: "la chapelle" }, { left: "fossé", right: "murailles" }, { left: "Léa", right: "chante" }] }, course)).not.toBeNull();
  });

  it("mcq: the right answer is in the course", () => {
    expect(anchoringProblem({ type: "mcq", question: "Quelle est la tour la plus haute ?", options: ["Le donjon", "La herse", "Le puits", "La chapelle"], answer: "Le donjon" }, course)).toBeNull();
    expect(anchoringProblem({ type: "mcq", question: "Qui garde le château ?", options: ["Les chevaliers", "a", "b", "c"], answer: "Les chevaliers" }, course)).not.toBeNull();
  });

  it("mental_math: a right calculation whose numbers are in the course", () => {
    expect(anchoringProblem({ type: "mental_math", question: "8 000 + 300 + 50 + 2", answer: 8352 }, course)).toBeNull();
    expect(anchoringProblem({ type: "mental_math", question: "8 000 + 300 + 50 + 2", answer: 8350 }, course)).not.toBeNull();
    expect(anchoringProblem({ type: "mental_math", question: "7 000 + 25", answer: 7025 }, course)).not.toBeNull();
    expect(anchoringProblem({ type: "mental_math", question: "Combien font huit mille ?", answer: 8000 }, course)).toMatch(/aucune opération/);
  });

  it("mental_math: × and ÷ are computed before + and −", () => {
    const text = "10 + 2 × 3 = 16 ; 12 ÷ 4 = 3";
    expect(anchoringProblem({ type: "mental_math", question: "10 + 2 × 3", answer: 16 }, text)).toBeNull();
    expect(anchoringProblem({ type: "mental_math", question: "12 ÷ 4", answer: 3 }, text)).toBeNull();
    expect(anchoringProblem({ type: "mental_math", question: "10 + 2 × 3", answer: 36 }, text)).not.toBeNull();
    expect(anchoringProblem({ type: "mental_math", question: "12 ÷ 4", answer: 3.5 }, text)).toMatch(/fausse/);
  });

  it("mental_math: digit groups written with a narrow no-break space are one number", () => {
    expect(anchoringProblem({ type: "mental_math", question: "8\u202f000 + 300 + 50 + 2", answer: 8352 }, course)).toBeNull();
  });

  it("true_false: the statement never gives its own answer", () => {
    expect(anchoringProblem({ type: "true_false", statement: "Le donjon est la tour la plus haute.", answer: true }, course)).toBeNull();
    expect(anchoringProblem({ type: "true_false", statement: "Le donjon est la tour la plus haute : c'est vrai !", answer: true }, course)).not.toBeNull();
    expect(anchoringProblem({ type: "true_false", statement: "C'est faux de dire que le fossé protège.", answer: false }, course)).not.toBeNull();
  });
});
