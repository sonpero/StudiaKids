import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const tokensCss = readFileSync(fileURLToPath(new URL("./tokens.css", import.meta.url)), "utf-8");

// docs/design/tokens.md, "Typo" and "Formes", as Tailwind theme tokens:
// text-*, rounded-*, shadow-* utilities.
const EXPECTED: Record<string, string> = {
  "--text-titre-xl": "40px",
  "--text-titre": "27px",
  "--text-sous-titre": "20px",
  "--text-corps-l": "18px",
  "--text-corps": "16px",
  "--text-petit": "14.5px",
  "--text-mini": "13px",
  "--text-micro": "12px",
  "--radius-pastille": "999px",
  "--radius-grande-carte": "30px",
  "--radius-carte": "20px",
  "--radius-bouton": "15px",
  "--shadow-petite": "0 3px 0 var(--color-ink)",
  "--shadow-moyenne": "0 4px 0 var(--color-ink)",
  "--shadow-primaire": "0 5px 0 var(--color-ink)",
  "--shadow-grande-carte": "0 6px 0 var(--color-ink)",
};

describe("shape and type tokens (docs/design/tokens.md)", () => {
  it("declares the type scale, the radii and the hard ink shadows", () => {
    for (const [token, value] of Object.entries(EXPECTED)) {
      expect(tokensCss, token).toContain(`${token}: ${value};`);
    }
  });
});
