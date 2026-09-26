import { COVERAGE_MIN_ITEMS } from "@studiakids/core";
import type { GeneratorCase } from "./args.js";

// A split fixture only proves something if it lands on the side of the
// coverage threshold its case names; otherwise nothing is written.
export function splitMismatch(fixtureCase: Exclude<GeneratorCase, "generate">, validItemCount: number): string | null {
  const enough = validItemCount >= COVERAGE_MIN_ITEMS;
  if (fixtureCase === "split" && !enough) return `${String(validItemCount)} items valides : il en faut au moins ${String(COVERAGE_MIN_ITEMS)} pour le cas "split".`;
  if (fixtureCase === "split-short" && enough) return `${String(validItemCount)} items valides : il en faut moins de ${String(COVERAGE_MIN_ITEMS)} pour le cas "split-short".`;
  return null;
}
