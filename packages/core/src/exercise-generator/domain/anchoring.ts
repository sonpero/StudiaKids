import type { ExerciseContent } from "./exercises.js";

// Case, accents, apostrophes, quotes and punctuation aside; digit groups
// joined (« 8 352 » is 8352), decimal commas kept as points.
export function normalize(text: string): string {
  let joined = text.normalize("NFC");
  for (let i = 0; i < 3; i++) joined = joined.replace(/(\d)[ \u00a0\u202f](?=\d{3}(?!\d))/g, "$1");
  return joined
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/[^\p{L}\p{N}.]+/gu, " ")
    .replace(/(?<!\d)\.|\.(?!\d)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Where a normalized phrase first appears as whole words, or -1.
function position(phrase: string, course: string): number {
  const needle = normalize(phrase);
  if (needle === "") return -1;
  const index = ` ${course} `.indexOf(` ${needle} `);
  return index;
}

const numbersIn = (normalized: string): number[] => [...normalized.matchAll(/\d+(?:\.\d+)?/g)].map((match) => Number(match[0]));

// A calculation made of numbers and + − × ÷, × and ÷ first; null when the
// question holds none.
function evaluate(question: string): number | null {
  const tokens = question
    .replace(/[−–]/g, "-")
    .replace(/[×*]|(?<=\d\s?)x(?=\s?\d)/g, "*")
    .replace(/[÷:]/g, "/")
    .split("=")[0]!
    .replace(/(\d)[ \u00a0\u202f](?=\d{3}(?!\d))/g, "$1")
    .replace(/(\d),(\d)/g, "$1.$2")
    .match(/\d+(?:\.\d+)?|[+\-*/]/g);
  if (!tokens || !tokens.some((token) => /[+\-*/]/.test(token))) return null;
  const values: number[] = [];
  const operators: string[] = [];
  let expectNumber = true;
  for (const token of tokens) {
    if (expectNumber) {
      if (!/\d/.test(token)) return null;
      values.push(Number(token));
    } else {
      if (!/[+\-*/]/.test(token)) return null;
      operators.push(token);
    }
    expectNumber = !expectNumber;
  }
  if (expectNumber) return null;
  // × and ÷ first, then + and − from left to right.
  const terms = [values[0]!];
  const signs: string[] = [];
  operators.forEach((operator, i) => {
    const next = values[i + 1]!;
    if (operator === "*") terms[terms.length - 1] = terms[terms.length - 1]! * next;
    else if (operator === "/") terms[terms.length - 1] = terms[terms.length - 1]! / next;
    else {
      signs.push(operator);
      terms.push(next);
    }
  });
  return terms.slice(1).reduce((sum, term, i) => (signs[i] === "-" ? sum - term : sum + term), terms[0]!);
}

// The anchoring rule, checked mechanically where it can be
// (docs/modules/exercise-generator.md): every exercise, answer included,
// must be checkable against the course text. Null when it holds.
export function anchoringProblem(content: ExerciseContent, courseText: string): string | null {
  const course = normalize(courseText);
  const absent = (phrase: string) => position(phrase, course) < 0;
  switch (content.type) {
    case "cloze":
      return content.blanks.some(absent) ? "texte à trous : une réponse absente du cours" : null;
    case "delayed_copy":
      return absent(content.wordOrPhrase) ? "copie : le mot absent du cours" : null;
    case "mcq":
      return absent(content.answer) ? "QCM : la bonne réponse absente du cours" : null;
    case "matching":
      return content.pairs.some((pair) => absent(pair.left) || absent(pair.right)) ? "appariement : un élément absent du cours" : null;
    case "reordering": {
      const positions = content.elements.map((element) => position(element, course));
      if (positions.some((at) => at < 0)) return "remise en ordre : un élément absent du cours";
      return positions.every((at, i) => i === 0 || at > positions[i - 1]!) ? null : "remise en ordre : un ordre que le cours ne donne pas";
    }
    case "mental_math": {
      const result = evaluate(content.question);
      if (result === null) return "calcul : aucune opération lisible";
      if (Math.abs(result - content.answer) > 1e-9) return "calcul : la réponse est fausse";
      const known = new Set(numbersIn(course));
      return numbersIn(normalize(content.question)).every((n) => known.has(n)) ? null : "calcul : un nombre absent du cours";
    }
    case "true_false":
      return /\b(vrai|vraie|faux|fausse)\b/.test(normalize(content.statement)) ? "vrai/faux : la phrase donne sa réponse" : null;
  }
}
