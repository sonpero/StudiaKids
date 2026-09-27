// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import type { PlayableExerciseDto } from "@studiakids/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameScreen } from "./GameScreen.js";

vi.mock("../lib/play.js", () => ({ answerExercise: vi.fn(), gameLabel: () => "Dictée flash" }));
vi.mock("../lib/progress.js", () => ({ getProgress: () => Promise.resolve({ total: 48, currentStreak: 0, bestStreak: 0 }), starsLabel: () => "48 étoiles" }));

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const flash: PlayableExerciseDto = { id: "e3", itemTitle: "Infinitif : chanter", type: "delayed_copy", wordOrPhrase: "chandail", displayDurationMs: 3000 };
function renderFlash() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <GameScreen exercise={flash} onNext={vi.fn()} onBack={vi.fn()} />
    </QueryClientProvider>,
  );
}
const has = (element: Element | null | undefined, ...tokens: string[]) => {
  for (const token of tokens) expect(element?.className.split(/\s+/), token).toContain(token);
};

// docs/design/flash.png: the whole screen goes night violet, the word on a
// cream card; never a countdown (CLAUDE.md rule 7), whatever the mockup.
describe("the flash, as drawn in docs/design/flash.png", () => {
  it("the screen is night violet, the word on a cream card, nothing to validate yet", () => {
    renderFlash();
    has(screen.getByRole("main"), "bg-violet-nuit");
    has(screen.getByTestId("flash-card"), "bg-canvas", "rounded-grande-carte", "border-3", "shadow-grande-carte");
    has(screen.getByText("chandail"), "font-display", "text-titre-xl");
    has(screen.getByRole("heading", { level: 1 }), "text-canvas");
    expect(screen.queryByRole("button", { name: "Valider" })).not.toBeInTheDocument();
  });
});

// docs/design/saisie.png: the typing screen after the flash.
describe("the typing, as drawn in docs/design/saisie.png", () => {
  function afterFlash() {
    renderFlash();
    act(() => {
      vi.advanceTimersByTime(3000);
    });
  }

  it("back to cream; a big centred field with a mandarine border, its label as a title", () => {
    afterFlash();
    expect(screen.getByRole("main").className).not.toContain("violet");
    const input = screen.getByRole("textbox", { name: "Écris le mot" });
    has(input, "h-16", "text-center", "font-display", "text-titre", "tracking-widest", "border-mandarine");
    has(screen.getByText("Écris le mot"), "font-display", "text-sous-titre");
  });

  it("« Valider » first, with a check; then « Je relis le mot », dashed", () => {
    afterFlash();
    const validate = screen.getByRole("button", { name: "Valider" });
    const reread = screen.getByRole("button", { name: "Je relis le mot" });
    expect(validate.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    has(reread, "border-dashed");
    expect(validate.compareDocumentPosition(reread) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
