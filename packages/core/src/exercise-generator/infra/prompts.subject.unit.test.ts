import { describe, expect, it } from "vitest";
import { generationPrompt, PROMPTS_VERSION, splitPrompt } from "./prompts.js";

// docs/modules/exercise-generator.md, "Règles par matière": the rules are
// asked in the prompts, and checked after generation all the same.
const items = [{ title: "La table de 7", body: "7 × 2 = 14" }];

describe("prompts, per subject", () => {
  it("version 5: the prompts changed with the per-subject rules", () => {
    expect(PROMPTS_VERSION).toBe("5");
  });

  it("the split never offers a reordering of numbers, calculations or a times table, in any subject", () => {
    for (const subject of ["maths", "french", null] as const) {
      const prompt = splitPrompt("CE2", "# Leçon", subject);
      expect(prompt).toMatch(/jamais pour une table de multiplication, une suite de calculs ou une suite de nombres/);
      expect(prompt).not.toMatch(/une suite écrite dans l'ordre/);
    }
  });

  it("maths: the split works on calculation, never spelling", () => {
    const prompt = splitPrompt("CE2", "# Leçon", "maths");
    expect(prompt).toMatch(/leçon de mathématiques/);
    expect(prompt).toMatch(/jamais delayed_copy/i);
    expect(prompt).toMatch(/cloze seulement si le trou est un nombre/);
    expect(splitPrompt("CE2", "# Leçon", "french")).not.toMatch(/leçon de mathématiques/);
    expect(splitPrompt("CE2", "# Leçon")).not.toMatch(/leçon de mathématiques/);
  });

  it("maths: a cloze's blank is a number, the other games are about calculations", () => {
    expect(generationPrompt("cloze", "CE2", "# Leçon", items, "maths")).toMatch(/chaque trou est un nombre écrit en chiffres, jamais un mot/);
    for (const type of ["mcq", "true_false", "matching"] as const) expect(generationPrompt(type, "CE2", "# Leçon", items, "maths"), type).toMatch(/sur un calcul de la leçon/);
    expect(generationPrompt("cloze", "CE2", "# Leçon", items, "french")).not.toMatch(/jamais un mot/);
  });

  it("the reordering never takes numbers or calculations, in any subject", () => {
    expect(generationPrompt("reordering", "CE2", "# Leçon", items, "history")).toMatch(/jamais des nombres, des calculs ni une table/);
  });

  it("the anchoring rule stays first, whatever the subject", () => {
    expect(generationPrompt("mental_math", "CE2", "# Leçon", items, "maths").startsWith("Règle d'ancrage, avant toute autre")).toBe(true);
  });
});
