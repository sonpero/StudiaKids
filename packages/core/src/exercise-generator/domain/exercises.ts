import { err, ok, type Result } from "../../shared/index.js";
import type { GameType } from "./game-types.js";

// Same shapes as exerciseContentSchema in packages/contracts.
export type ExerciseContent =
  | { type: "delayed_copy"; wordOrPhrase: string }
  | { type: "mcq"; question: string; options: string[]; answer: string }
  | { type: "matching"; pairs: { left: string; right: string }[] }
  | { type: "reordering"; elements: string[] }
  | { type: "cloze"; text: string; blanks: string[] }
  | { type: "true_false"; statement: string; answer: boolean }
  | { type: "mental_math"; question: string; answer: number };

export type ParsedExercise = { item: number; content: ExerciseContent };

type Raw = Record<string, unknown>;
const isString = (value: unknown): value is string => typeof value === "string" && value.trim() !== "";
const strings = (value: unknown): string[] | null => (Array.isArray(value) && value.every(isString) ? value : null);

function content(type: GameType, raw: Raw): Result<ExerciseContent, string> {
  switch (type) {
    case "mcq": {
      const options = strings(raw.options);
      if (!isString(raw.question) || !options || !isString(raw.answer)) return err("mcq: question, options, réponse");
      if (options.length !== 4 || new Set(options).size !== 4) return err("mcq: exactement 4 options distinctes");
      if (!options.includes(raw.answer)) return err("mcq: la réponse n'est pas une des options");
      return ok({ type, question: raw.question, options, answer: raw.answer });
    }
    case "cloze": {
      const blanks = strings(raw.blanks);
      if (!isString(raw.text) || !blanks || blanks.length === 0) return err("cloze: texte et réponses");
      const markers = [...raw.text.matchAll(/\{\{(\d+)\}\}/g)].map((match) => Number(match[1]));
      const expected = blanks.map((_, i) => i);
      if (markers.length !== blanks.length || [...markers].sort((a, b) => a - b).some((n, i) => n !== expected[i])) return err("cloze: les trous {{0}}… ne correspondent pas aux réponses");
      return ok({ type, text: raw.text, blanks });
    }
    case "matching": {
      const pairs = Array.isArray(raw.pairs) ? (raw.pairs as unknown[]) : null;
      if (!pairs || !pairs.every((pair) => pair !== null && typeof pair === "object" && isString((pair as Raw).left) && isString((pair as Raw).right))) return err("matching: paires gauche/droite");
      if (pairs.length < 3 || pairs.length > 6) return err("matching: 3 à 6 paires");
      return ok({ type, pairs: (pairs as Raw[]).map((pair) => ({ left: String(pair.left), right: String(pair.right) })) });
    }
    case "reordering": {
      const elements = strings(raw.elements);
      if (!elements) return err("reordering: éléments");
      if (elements.length < 3 || elements.length > 6) return err("reordering: 3 à 6 éléments");
      return ok({ type, elements });
    }
    case "delayed_copy": {
      if (!isString(raw.wordOrPhrase)) return err("delayed_copy: mot ou phrase");
      if (raw.wordOrPhrase.trim().split(/\s+/).length > 6) return err("delayed_copy: 6 mots au plus");
      return ok({ type, wordOrPhrase: raw.wordOrPhrase.trim() });
    }
    case "true_false": {
      if (!isString(raw.statement) || typeof raw.answer !== "boolean") return err("true_false: phrase et réponse");
      return ok({ type, statement: raw.statement, answer: raw.answer });
    }
    case "mental_math": {
      if (!isString(raw.question) || typeof raw.answer !== "number" || !Number.isFinite(raw.answer)) return err("mental_math: question et réponse numérique");
      return ok({ type, question: raw.question, answer: raw.answer });
    }
  }
}

// One exercise as the model sent it, checked on its own: an invalid one is
// dropped alone (CLAUDE.md rule 4, exception decided at M3's opening).
export function parseExercise(type: GameType, raw: unknown, itemCount: number): Result<ParsedExercise, string> {
  if (raw === null || typeof raw !== "object") return err("exercice illisible");
  const item = (raw as Raw).item;
  if (typeof item !== "number" || !Number.isInteger(item) || item < 0 || item >= itemCount) return err("item hors de la liste");
  const parsed = content(type, raw as Raw);
  return parsed.ok ? ok({ item, content: parsed.value }) : parsed;
}
