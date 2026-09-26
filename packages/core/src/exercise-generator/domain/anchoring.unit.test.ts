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

// Real cases (pnpm eval, prompts v2): calculations taken from the page's
// own exercise section passed the check above — right, and made of the
// course's numbers — but the lesson never gives their result. The course
// must write the calculation with its result, in either direction.
describe("anchoringProblem, mental_math written with its result in the course", () => {
  const additions = `# CALC 2 – J'additionne jusqu'à 20

## 2. Des additions à connaître

- 7 + 3 = 10
- 8 + 5 = 13
- 9 + 4 = 13
- 6 + 6 = 12, c'est un double

## 3. Compter en avançant

Pour calculer 8 + 5, je pars de 8 et j'avance de 5 : 9, 10, 11, 12, 13.

## À retenir

Dans une addition, on peut changer l'ordre des nombres :
5 + 8 = 8 + 5 = 13.

## Exercices

1. Calcule : 4 + 6 = …
2. Calcule : 7 + 7 = …`;
  const circle = `Si le rayon mesure 3 cm, le diamètre mesure 2 × 3 = 6 cm.

Si le diamètre mesure 10 cm, le rayon mesure 10 ÷ 2 = 5 cm.

diamètre = 2 × rayon`;
  const table = `- 4 × 6 = 24
Multiplier par 4, c'est doubler deux fois : 4 × 6, c'est le double de 12, donc 24.

4 × 7 = 28 et 7 × 4 = 28 :
on peut changer l'ordre des facteurs.`;
  const mentalMath = (question: string, answer: number) => ({ type: "mental_math" as const, question, answer });

  it("refuses a calculation the lesson only asks, never answers (its exercise section)", () => {
    expect(anchoringProblem(mentalMath("7 + 7", 14), additions)).toMatch(/résultat/);
    expect(anchoringProblem(mentalMath("4 + 6", 10), additions)).toMatch(/résultat/);
  });

  it("accepts the lesson's own calculations, including in a chain of equalities", () => {
    for (const [question, answer] of [["8 + 5", 13], ["9 + 4", 13], ["6 + 6", 12], ["5 + 8", 13], ["Combien font 7 + 3 ?", 10]] as const) {
      expect(anchoringProblem(mentalMath(question, answer), additions), question).toBeNull();
    }
  });

  it("accepts a result followed by its unit, or written first, and a calculation after words", () => {
    expect(anchoringProblem(mentalMath("2 × 3", 6), circle)).toBeNull();
    expect(anchoringProblem(mentalMath("10 ÷ 2", 5), circle)).toBeNull();
    expect(anchoringProblem(mentalMath("4 × 6", 24), table)).toBeNull();
    expect(anchoringProblem(mentalMath("7 × 4", 28), table)).toBeNull();
    expect(anchoringProblem(mentalMath("4 x 7", 28), table)).toBeNull();
  });

  it("reads decimal commas and trailing zeros as the same number", () => {
    expect(anchoringProblem(mentalMath("1,50 + 1", 2.5), "Le prix : 1,50 + 1 = 2,50 euros.")).toBeNull();
  });

  it("reads the ways a primary school writes signs: « : » for ÷, « − » for -", () => {
    expect(anchoringProblem(mentalMath("10 ÷ 2", 5), "10 : 2 = 5")).toBeNull();
    expect(anchoringProblem(mentalMath("14 - 7", 7), "14 − 7 = 7")).toBeNull();
    expect(anchoringProblem(mentalMath("14 − 7", 7), "14 − 7 = 7")).toBeNull();
  });

  it("a blank to fill ends the calculation: the next line's or the next question's number is not its result", () => {
    expect(anchoringProblem(mentalMath("1 + 1", 2), "1. Calcule : 1 + 1 = ___\n2. Calcule : 3 + 3 = ___")).toMatch(/résultat/);
    expect(anchoringProblem(mentalMath("7 + 7", 14), "Calcule : 7 + 7 = ? 14 − 7 = ?")).toMatch(/résultat/);
  });

  it("never takes the result from another calculation of the same line or the next one", () => {
    expect(anchoringProblem(mentalMath("3 × 2", 6), circle)).toMatch(/résultat/);
    expect(anchoringProblem(mentalMath("2 × 5", 10), circle)).not.toBeNull();
    expect(anchoringProblem(mentalMath("2 × 3", 36), "12 × 3 = 36 ; 2 et 3")).not.toBeNull();
    expect(anchoringProblem(mentalMath("2 × 3", 6), "Le 6 vient de 2 × 3 = …")).toMatch(/résultat/);
    expect(anchoringProblem(mentalMath("7 + 7", 14), "Calcule : 7 + 7 = … puis ajoute 14.")).toMatch(/résultat/);
    expect(anchoringProblem(mentalMath("2 × 3", 6), "2 × 3 = 3 + 3, et non 6")).toMatch(/résultat/);
    // Compared token by token: « 12 × 3 » does not end with the calculation « 2 × 3 ».
    expect(anchoringProblem(mentalMath("2 × 3", 6), "12 × 3 = 6 ; 2")).toMatch(/résultat/);
  });
});
