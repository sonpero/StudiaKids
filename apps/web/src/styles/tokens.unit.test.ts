import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const tokensCss = readFileSync(fileURLToPath(new URL("./tokens.css", import.meta.url)), "utf-8");
const indexHtml = readFileSync(fileURLToPath(new URL("../../index.html", import.meta.url)), "utf-8");

// docs/ui.md, "Direction visuelle" — values copied verbatim from
// docs/design/tokens.md.
const EXPECTED_COLOR_TOKENS: Record<string, string> = {
  "--color-canvas": "#fff6e9",
  "--color-ink": "#2b2140",
  "--color-ink-soft": "#5a5270",
  "--color-mandarine": "#ff7a4d",
  "--color-turquoise": "#21c1b4",
  "--color-soleil": "#ffc642",
  "--color-succes": "#3fc66b",
  "--color-violet-nuit": "#3a2b5c",
  "--color-peche": "#ffe3d6",
  "--color-vert-clair": "#c9f2d6",
};

describe("brand tokens (M0 acceptance: brand colors and both fonts loaded and usable via tokens)", () => {
  it("declares every brand color token from docs/design/tokens.md with the exact value", () => {
    for (const [token, value] of Object.entries(EXPECTED_COLOR_TOKENS)) {
      const match = new RegExp(`${token}:\\s*${value}`, "i").exec(tokensCss);
      expect(match, `${token} not found with value ${value} in tokens.css`).not.toBeNull();
    }
  });

  it("declares --font-display as Baloo 2 and --font-text as Lexend", () => {
    expect(tokensCss).toMatch(/--font-display:\s*"Baloo 2"/);
    expect(tokensCss).toMatch(/--font-text:\s*"Lexend"/);
  });

  it("index.html actually loads both fonts (Baloo 2 and Lexend) from Google Fonts", () => {
    expect(indexHtml).toContain("fonts.googleapis.com");
    expect(indexHtml).toMatch(/family=Baloo\+2/);
    expect(indexHtml).toMatch(/family=Lexend/);
  });
});
