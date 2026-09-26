// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameScreen } from "./GameScreen.js";

const api = vi.hoisted(() => ({ answerExercise: vi.fn(), gameLabel: (type: string) => type }));
vi.mock("../lib/play.js", () => api);
const progress = vi.hoisted(() => ({ getProgress: vi.fn(() => Promise.resolve({ total: 4, currentStreak: 1, bestStreak: 3 })), starsLabel: (n: number) => `${String(n)} étoiles` }));
vi.mock("../lib/progress.js", () => progress);

afterEach(() => cleanup());

// docs/ui.md, M5: the counter in a game moves with each answer.
describe("GameScreen, the star counter", () => {
  it("shows the total, and the new one as soon as the answer comes back", async () => {
    api.answerExercise.mockResolvedValue({ units: [{ id: "0", correct: true }], progress: { total: 5, currentStreak: 2, bestStreak: 3, stars: 1, celebrate: null } });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <GameScreen exercise={{ id: "e1", itemTitle: "x", type: "true_false", statement: "Vrai." }} onNext={vi.fn()} onBack={vi.fn()} />
      </QueryClientProvider>,
    );
    expect(await screen.findByTestId("star-counter")).toHaveAccessibleName("4 étoiles");

    fireEvent.click(screen.getByRole("button", { name: "Vrai" }));
    fireEvent.click(screen.getByRole("button", { name: "Valider" }));

    await screen.findByText(/Bravo !|Bien joué !|C'est ça !/);
    expect(screen.getByTestId("star-counter")).toHaveAccessibleName("5 étoiles");
  });
});
