// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameScreen } from "./GameScreen.js";

const api = vi.hoisted(() => ({ answerExercise: vi.fn(), gameLabel: (type: string) => type }));
vi.mock("../lib/play.js", () => api);

afterEach(() => {
  cleanup();
  api.answerExercise.mockReset();
});

const answered = (correct: boolean, celebrate: "streak-bonus" | "comeback" | null) =>
  api.answerExercise.mockResolvedValue({ units: [{ id: "0", correct }], progress: { total: 6, currentStreak: 5, bestStreak: 5, stars: 2, celebrate } });

async function play(): Promise<void> {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <GameScreen exercise={{ id: "e1", itemTitle: "x", type: "true_false", statement: "Vrai." }} onNext={vi.fn()} onBack={vi.fn()} />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Vrai" }));
  fireEvent.click(screen.getByRole("button", { name: "Valider" }));
  await screen.findByRole("button", { name: "Jeu suivant" });
}

const mascot = () => screen.getByTestId("mascot");

// docs/ui.md, M5: the joy dance on a streak bonus and on a comeback.
describe("GameScreen, the joy dance", () => {
  it("a streak bonus: joy, the streak's words, and the dance", async () => {
    answered(true, "streak-bonus");
    await play();

    expect(screen.getByText(/Super série !|Quelle série, bravo !/)).toBeInTheDocument();
    expect(mascot()).toHaveAttribute("data-pose", "joy");
    expect(mascot()).toHaveAttribute("data-motion", "dance");
  });

  it("a comeback (a first success after a miss): joy and the dance", async () => {
    answered(true, "comeback");
    await play();

    expect(mascot()).toHaveAttribute("data-pose", "joy");
    expect(mascot()).toHaveAttribute("data-motion", "dance");
  });

  it("a plain right answer: joy without the dance; a wrong one: never joy, never a dance", async () => {
    answered(true, null);
    await play();
    expect(mascot()).toHaveAttribute("data-pose", "joy");
    expect(mascot()).not.toHaveAttribute("data-motion");
    cleanup();

    answered(false, null);
    await play();
    expect(mascot()).toHaveAttribute("data-pose", "waiting");
    expect(mascot()).not.toHaveAttribute("data-motion");
  });
});
