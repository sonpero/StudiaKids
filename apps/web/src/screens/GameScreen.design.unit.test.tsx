// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import type { PlayableExerciseDto } from "@studiakids/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameScreen } from "./GameScreen.js";

const api = vi.hoisted(() => ({ answerExercise: vi.fn(), gameLabel: (type: string) => (type === "mcq" ? "Quiz" : type) }));
vi.mock("../lib/play.js", () => api);
vi.mock("../lib/progress.js", () => ({ getProgress: () => Promise.resolve({ total: 48, currentStreak: 0, bestStreak: 0 }), starsLabel: () => "48 étoiles" }));

afterEach(() => {
  cleanup();
  api.answerExercise.mockReset();
});

const mcq: PlayableExerciseDto = { id: "e1", itemTitle: "Le verbe « chante »", type: "mcq", question: "Quel mot est le verbe ?", options: ["Léa", "chante", "une", "chanson"] };
const onBack = vi.fn();
function renderGame() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <GameScreen exercise={mcq} onNext={vi.fn()} onBack={onBack} />
    </QueryClientProvider>,
  );
}
const has = (element: Element | null | undefined, ...tokens: string[]) => {
  for (const token of tokens) expect(element?.className.split(/\s+/), token).toContain(token);
};
function answer(correct: boolean, stars = 1): void {
  api.answerExercise.mockResolvedValue({ units: [{ id: "0", correct }], ...(correct ? {} : { correction: { chosenOption: "chante" } }), progress: { total: 49, currentStreak: 1, bestStreak: 1, stars, celebrate: null } });
  renderGame();
  fireEvent.click(screen.getByRole("button", { name: correct ? "chante" : "Léa" }));
  fireEvent.click(screen.getByRole("button", { name: "Valider" }));
}

// docs/design/flash.png, saisie.png, bravo.png: the frame of every game.
describe("GameScreen, as drawn in the mockups", () => {
  it("the shared header: a square button back to the games, the game's name centred, the star pill", async () => {
    renderGame();
    has(screen.getByRole("heading", { name: "Quiz", level: 1 }), "text-center");
    fireEvent.click(screen.getByRole("button", { name: "Tous les jeux" }));
    expect(onBack).toHaveBeenCalled();
    expect(await screen.findByTestId("star-counter")).toBeInTheDocument();
  });

  it("a chosen answer takes the active peach", () => {
    renderGame();
    fireEvent.click(screen.getByRole("button", { name: "chante" }));
    has(screen.getByRole("button", { name: "chante" }), "bg-peche");
  });

  it("a right answer: the bravo screen — its line as a big title, the joyful mascot, the star won, « Jeu suivant » with an arrow", async () => {
    answer(true);
    const line = await screen.findByText(/Bravo !|Bien joué !|C'est ça !/);
    has(line, "font-display", "text-titre-xl");
    expect(screen.getByTestId("mascot")).toHaveAttribute("data-size", "lg");
    expect(within(screen.getByTestId("stars-won")).getByText("+1")).toBeInTheDocument();
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    const next = screen.getByRole("button", { name: "Jeu suivant" });
    has(next, "bg-mandarine");
    expect(next.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("no star won, no star badge", async () => {
    answer(true, 0);
    await screen.findByText(/Bravo !|Bien joué !|C'est ça !/);
    expect(screen.queryByTestId("stars-won")).not.toBeInTheDocument();
  });

  it("a wrong answer keeps the question in view, the right one in a card", async () => {
    answer(false);
    has(await screen.findByRole("status"), "rounded-carte", "border-3", "bg-white");
    expect(screen.getByRole("group")).toBeInTheDocument();
  });
});
