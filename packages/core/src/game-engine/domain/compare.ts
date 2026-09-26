import type { ExerciseContent } from "../../exercise-generator/index.js";
import { err, ok, type Result } from "../../shared/index.js";

export type UnitResult = { id: string; correct: boolean };
export type ComparisonResult = { units: UnitResult[] };

// What the child gives, per game type (mirrors GIVEN_ANSWER_SCHEMAS in
// packages/contracts: core depends on nothing but zod).
export type GivenAnswer = {
  delayed_copy: { text: string };
  mcq: { chosenOption: string };
  matching: { pairs: { left: string; right: string }[] };
  reordering: { order: string[] };
  cloze: { values: string[] };
  true_false: { value: boolean };
  mental_math: { value: string };
};

type Content<T extends ExerciseContent["type"]> = Extract<ExerciseContent, { type: T }>;

const single = (correct: boolean): ComparisonResult => ({ units: [{ id: "0", correct }] });
const units = (flags: boolean[]): ComparisonResult => ({ units: flags.map((correct, i) => ({ id: String(i), correct })) });

// A phone keyboard types ’ for ': a keyboard artefact, not spelling
// (docs/modules/game-engine.md, « à valider »).
const apostrophes = (text: string) => text.replace(/[’‘ʼ]/g, "'");

export const compareMcq = (given: GivenAnswer["mcq"], content: Content<"mcq">) => single(given.chosenOption === content.answer);

export const compareTrueFalse = (given: GivenAnswer["true_false"], content: Content<"true_false">) => single(given.value === content.answer);

// Spaces (\s covers the no-break ones of digit groups) and a decimal comma aside; anything that
// is not plainly a number is incorrect, never an exception.
export function compareMentalMath(given: GivenAnswer["mental_math"], content: Content<"mental_math">): ComparisonResult {
  const written = given.value.replace(/\s/g, "").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(written)) return single(false);
  return single(Math.abs(Number(written) - content.answer) < 1e-9);
}

// Exact: reproducing the spelling is the whole exercise — case and accents
// count; only surrounding spaces and the apostrophe's form do not.
export const compareDelayedCopy = (given: GivenAnswer["delayed_copy"], content: Content<"delayed_copy">) =>
  single(apostrophes(given.text.trim()) === apostrophes(content.wordOrPhrase.trim()));

// Tolerant: recalling the content is the point, not its spelling's details.
function tolerant(text: string): string {
  return apostrophes(text)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s*[.!?,;:…]+$/, "");
}

export const compareCloze = (given: GivenAnswer["cloze"], content: Content<"cloze">) =>
  units(content.blanks.map((blank, i) => tolerant(given.values[i] ?? "") === tolerant(blank)));

// Each expected pair against the first given pairing of its left side,
// whatever the order the pairs were given in.
export const compareMatching = (given: GivenAnswer["matching"], content: Content<"matching">) =>
  units(content.pairs.map((pair) => given.pairs.find((candidate) => candidate.left === pair.left)?.right === pair.right));

// Position by position: two swapped neighbours never fail the rest.
export const compareReordering = (given: GivenAnswer["reordering"], content: Content<"reordering">) =>
  units(content.elements.map((element, i) => given.order[i] === element));

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const isStrings = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === "string");
const isPairs = (value: unknown): value is { left: string; right: string }[] =>
  Array.isArray(value) && value.every((pair) => isRecord(pair) && typeof pair.left === "string" && typeof pair.right === "string");

// The answer's shape is checked for the exercise's own type (known only
// once the exercise is loaded), then compared; a malformed answer is
// refused, never thrown.
export function checkAnswer(content: ExerciseContent, raw: unknown): Result<ComparisonResult, "invalid-answer"> {
  const invalid = err("invalid-answer" as const);
  if (!isRecord(raw)) return invalid;
  switch (content.type) {
    case "mcq":
      return typeof raw.chosenOption === "string" ? ok(compareMcq({ chosenOption: raw.chosenOption }, content)) : invalid;
    case "true_false":
      return typeof raw.value === "boolean" ? ok(compareTrueFalse({ value: raw.value }, content)) : invalid;
    case "mental_math":
      return typeof raw.value === "string" ? ok(compareMentalMath({ value: raw.value }, content)) : invalid;
    case "delayed_copy":
      return typeof raw.text === "string" ? ok(compareDelayedCopy({ text: raw.text }, content)) : invalid;
    case "cloze":
      return isStrings(raw.values) ? ok(compareCloze({ values: raw.values }, content)) : invalid;
    case "matching":
      return isPairs(raw.pairs) ? ok(compareMatching({ pairs: raw.pairs }, content)) : invalid;
    case "reordering":
      return isStrings(raw.order) ? ok(compareReordering({ order: raw.order }, content)) : invalid;
  }
}
