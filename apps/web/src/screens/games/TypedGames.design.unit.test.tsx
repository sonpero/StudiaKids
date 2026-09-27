// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ClozeGame, MentalMathGame } from "./TypedGames.js";

afterEach(cleanup);
const has = (element: Element | null | undefined, ...tokens: string[]) => {
  for (const token of tokens) expect(element?.className.split(/\s+/), token).toContain(token);
};

// The shared field (docs/design/saisie.png: mandarine border on focus).
describe("typed games' fields, in the mockups' language", () => {
  it("mental math: the shared field, the answer big and centred", () => {
    render(<MentalMathGame question="8 + 5" onAnswer={vi.fn()} />);
    has(screen.getByRole("textbox", { name: "Ta réponse" }), "h-14", "rounded-carte", "focus:border-mandarine", "text-center", "font-display");
  });

  it("cloze: blanks with the ink outline and the mandarine focus", () => {
    render(<ClozeGame text="Hier, Léa {{0}}." blankCount={1} onAnswer={vi.fn()} />);
    has(screen.getByRole("textbox", { name: "Trou 1" }), "border-3", "focus:border-mandarine");
  });
});
