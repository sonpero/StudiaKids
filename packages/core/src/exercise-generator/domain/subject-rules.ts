import type { Subject } from "../../ingestion/index.js";
import type { ExerciseContent } from "./exercises.js";
import type { GameType } from "./game-types.js";

// null: a course whose subject was not given (docs/modules/ingestion.md).
export type CourseSubject = Subject | null;

const NUMBER_WORDS = new Set([
  "zero", "un", "une", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize",
  "vingt", "vingts", "trente", "quarante", "cinquante", "soixante", "cent", "cents", "mille", "million", "millions", "milliard", "milliards",
]);
// Only between numbers: alone, they make no number.
const CALCULATION_WORDS = new Set(["et", "fois", "plus", "moins", "egal", "egale", "egalent", "font", "fait", "divise", "par", "x"]);

// A number (in digits or in words) or a calculation, and nothing else:
// « 7 × 8 = 56 », « 1 000 », « quatre-vingt-dix » — never « 1789 : la
// Révolution » nor « Aligne les unités ».
export function isNumberOrCalculation(element: string): boolean {
  const tokens = element
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token !== "");
  const isNumber = (token: string) => /^\d+$/.test(token) || NUMBER_WORDS.has(token);
  return tokens.some(isNumber) && tokens.every((token) => isNumber(token) || CALCULATION_WORDS.has(token));
}

// A number written in digits: « 56 », « 8 000 », « 3,5 », « -4 », « 3/4 ».
function isWrittenNumber(blank: string): boolean {
  const text = blank.trim().replace(/[\u00a0\u202f]/g, " ");
  return /^[-−]?(?:\d{1,3}(?: \d{3})+|\d+)(?:[.,]\d+)?$/.test(text) || /^\d+\/\d+$/.test(text);
}

// In maths, the child works on calculation, not spelling (decided on
// 2026-10-04).
export function isGameTypeAllowed(subject: CourseSubject, type: GameType): boolean {
  return !(subject === "maths" && type === "delayed_copy");
}

// Why an exercise is forbidden for the course's subject, or null. Checked
// after generation, whatever the prompts asked.
export function subjectProblem(subject: CourseSubject, content: ExerciseContent): string | null {
  if (!isGameTypeAllowed(subject, content.type)) return `${content.type}: interdit pour cette matière`;
  // Any subject: putting numbers in order is not a lesson's sequence.
  if (content.type === "reordering" && content.elements.some(isNumberOrCalculation)) return "reordering: jamais une suite de nombres ou de calculs";
  if (subject === "maths" && content.type === "cloze" && !content.blanks.every(isWrittenNumber)) return "cloze: en maths, chaque trou est un nombre";
  return null;
}
