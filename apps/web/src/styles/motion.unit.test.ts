import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const motionCss = readFileSync(fileURLToPath(new URL("./motion.css", import.meta.url)), "utf-8");

// docs/ui.md "Icônes et mouvement" (M5): every animation has a still
// version under prefers-reduced-motion.
describe("motion.css", () => {
  it("the stylesheet breathes idle, dances joy, bounces the star — and stops all of it under reduced motion", () => {
    expect(motionCss).toMatch(/@keyframes mascot-breathe/);
    expect(motionCss).toMatch(/@keyframes mascot-dance/);
    expect(motionCss).toMatch(/@keyframes star-bounce/);
    expect(motionCss).toMatch(/\[data-pose="idle"\][^{]*\{[^}]*animation:\s*mascot-breathe/);
    expect(motionCss).toMatch(/\[data-motion="dance"\][^{]*\{[^}]*animation:\s*mascot-dance/);
    const reduced = /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/.exec(motionCss)?.[1] ?? "";
    expect(reduced).toMatch(/\[data-testid="mascot"\]/);
    expect(reduced).toMatch(/\[data-bounce\]/);
    expect(reduced).toMatch(/animation:\s*none/);
  });
});
