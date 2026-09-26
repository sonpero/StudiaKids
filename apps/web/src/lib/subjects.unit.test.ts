import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { subjectLabel } from "./subjects.js";

const tokensCss = readFileSync(fileURLToPath(new URL("../styles/tokens.css", import.meta.url)), "utf-8");

// docs/glossaire.md, "Matières": the label shown stays French.
describe("subjectLabel", () => {
  it("shows every subject in French", () => {
    expect(["maths", "french", "history", "geography", "science", "english", "other"].map((s) => subjectLabel(s as never))).toEqual([
      "Maths",
      "Français",
      "Histoire",
      "Géographie",
      "Sciences",
      "Anglais",
      "Autre",
    ]);
  });
});

// A course stores its color as a token name (docs/ui.md): every subject's
// pastel must exist in tokens.css, provisional ones included, with the
// value from docs/design/tokens.md.
describe("subject tokens", () => {
  const expected: Record<string, string> = {
    "--matiere-maths": "#ffc2d4",
    "--matiere-francais": "#c9bbff",
    "--matiere-histoire": "#b8e9d0",
    "--matiere-geographie": "#bde3ff",
    "--matiere-sciences": "#e2f0a8",
    "--matiere-anglais": "#f2c4f0",
    "--matiere-autre": "#d5dce8",
  };
  for (const [token, value] of Object.entries(expected)) {
    it(`declares ${token}`, () => {
      expect(new RegExp(`${token}:\\s*${value}`, "i").test(tokensCss)).toBe(true);
    });
  }
});
