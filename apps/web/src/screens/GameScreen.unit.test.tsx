// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import type { PlayableExerciseDto } from "@studiakids/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameScreen } from "./GameScreen.js";

const api = vi.hoisted(() => ({ answerExercise: vi.fn(), gameLabel: (type: string) => ({ mcq: "Quiz", true_false: "Vrai ou faux" })[type] ?? type }));
vi.mock("../lib/play.js", () => api);

afterEach(() => {
  cleanup();
  api.answerExercise.mockReset();
});

const mcq: PlayableExerciseDto = { id: "e1", itemTitle: "Le verbe « chante »", type: "mcq", question: "Quel mot est le verbe ?", options: ["Léa", "chante", "une", "chanson"] };
const trueFalse: PlayableExerciseDto = { id: "e2", itemTitle: "L'infinitif", type: "true_false", statement: "L'infinitif change tout le temps." };

function renderGame(exercise: PlayableExerciseDto) {
  const onNext = vi.fn();
  const onBack = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
      <GameScreen exercise={exercise} onNext={onNext} onBack={onBack} />
    </QueryClientProvider>,
  );
  return { onNext, onBack };
}

const pose = () => screen.getByTestId("mascot").getAttribute("data-pose");

// docs/ui.md, "Jouer (M4)": answer by tapping, then « Valider »; the
// mascot reacts at once — joy, or a calm waiting, never sorry nor glitch.
describe("GameScreen, quiz and true or false", () => {
  it("shows the game's name, its item and its question; « Valider » waits for a choice", () => {
    renderGame(mcq);

    expect(screen.getByRole("heading", { name: "Quiz", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Le verbe « chante »")).toBeInTheDocument();
    expect(screen.getByText("Quel mot est le verbe ?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Valider" })).toBeDisabled();
  });

  it("a tapped option is marked, sent on « Valider »; a right answer gets joy and « Jeu suivant »", async () => {
    api.answerExercise.mockResolvedValue({ units: [{ id: "0", correct: true }] });
    const { onNext } = renderGame(mcq);

    fireEvent.click(screen.getByRole("button", { name: "chante" }));
    expect(screen.getByRole("button", { name: "chante" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Valider" }));

    expect(await screen.findByText(/Bravo !|Bien joué !|C'est ça !/)).toBeInTheDocument();
    expect(pose()).toBe("joy");
    expect(api.answerExercise).toHaveBeenCalledWith("e1", { chosenOption: "chante" }, false);
    expect(screen.queryByRole("button", { name: "Encore une fois" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Jeu suivant" }));
    expect(onNext).toHaveBeenCalled();
  });

  it("a wrong answer gets a calm waiting mascot, and « Encore une fois » starts the game over", async () => {
    api.answerExercise.mockResolvedValue({ units: [{ id: "0", correct: false }] });
    renderGame(trueFalse);

    fireEvent.click(screen.getByRole("button", { name: "Vrai" }));
    fireEvent.click(screen.getByRole("button", { name: "Valider" }));

    expect(await screen.findByText(/Pas tout à fait\. Essaie encore !|Presque ! On continue \?/)).toBeInTheDocument();
    expect(pose()).toBe("waiting");
    expect(api.answerExercise).toHaveBeenCalledWith("e2", { value: true }, false);
    fireEvent.click(screen.getByRole("button", { name: "Encore une fois" }));
    expect(screen.getByRole("button", { name: "Vrai" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Valider" })).toBeDisabled();
    expect(screen.queryByTestId("mascot")).not.toBeInTheDocument();
  });

  it("a failed sending: glitch, a child's sentence, and « Réessaie » sends again", async () => {
    api.answerExercise.mockRejectedValueOnce(new Error("500")).mockResolvedValueOnce({ units: [{ id: "0", correct: true }] });
    renderGame(trueFalse);

    fireEvent.click(screen.getByRole("button", { name: "Faux" }));
    fireEvent.click(screen.getByRole("button", { name: "Valider" }));
    expect(await screen.findByText("Oh, quelque chose a coincé. On réessaie ?")).toBeInTheDocument();
    expect(pose()).toBe("glitch");
    fireEvent.click(screen.getByRole("button", { name: "Réessaie" }));

    expect(await screen.findByText(/Bravo !|Bien joué !|C'est ça !/)).toBeInTheDocument();
    expect(api.answerExercise).toHaveBeenCalledTimes(2);
  });

  it("« Tous les jeux » goes back to the list", () => {
    const { onBack } = renderGame(mcq);

    fireEvent.click(screen.getByRole("button", { name: "Tous les jeux" }));
    expect(onBack).toHaveBeenCalled();
  });
});
