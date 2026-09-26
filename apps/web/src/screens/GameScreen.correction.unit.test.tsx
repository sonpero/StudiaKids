// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import type { PlayableExerciseDto } from "@studiakids/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameScreen } from "./GameScreen.js";

const api = vi.hoisted(() => ({ answerExercise: vi.fn(), gameLabel: (type: string) => type }));
vi.mock("../lib/play.js", () => api);

afterEach(() => {
  cleanup();
  api.answerExercise.mockReset();
  vi.useRealTimers();
});

function renderGame(exercise: PlayableExerciseDto) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <GameScreen exercise={exercise} onNext={vi.fn()} onBack={vi.fn()} />
    </QueryClientProvider>,
  );
}

const wrong = (correction: unknown) => api.answerExercise.mockResolvedValue({ units: [{ id: "0", correct: false }], correction });

async function answerWrong(exercise: PlayableExerciseDto, answer: () => void): Promise<void> {
  renderGame(exercise);
  answer();
  fireEvent.click(screen.getByRole("button", { name: "Valider" }));
  await screen.findByText(/Pas tout à fait\. Essaie encore !|Presque ! On continue \?/);
}

// M4 closing decision: after a wrong answer, the right one is shown
// carried by the mascot, until « Continuer » (texts « à valider »).
describe("GameScreen, the right answer after a wrong one", () => {
  // M5, T0 (decision): the right answer stays until « Continuer » is
  // tapped, no longer 4 seconds.
  it("shows it next to the mascot, and keeps it until « Continuer » is tapped", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    wrong({ chosenOption: "chante" });
    await answerWrong({ id: "e1", itemTitle: "x", type: "mcq", question: "Quel mot est le verbe ?", options: ["Léa", "chante", "une", "chanson"] }, () => {
      fireEvent.click(screen.getByRole("button", { name: "Léa" }));
    });

    expect(screen.getByRole("status")).toHaveTextContent("La bonne réponse : chante");
    expect(screen.getByTestId("mascot")).toHaveAttribute("data-pose", "waiting");
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByText("La bonne réponse : chante")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Continuer" }));

    expect(screen.queryByText("La bonne réponse : chante")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Continuer" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Encore une fois" })).toBeInTheDocument();
  });

  it("says it the way each game needs", async () => {
    const cases: [PlayableExerciseDto, () => void, unknown, string[]][] = [
      [{ id: "e", itemTitle: "x", type: "true_false", statement: "Faux." }, () => fireEvent.click(screen.getByRole("button", { name: "Vrai" })), { value: false }, ["C'était faux."]],
      [{ id: "e", itemTitle: "x", type: "true_false", statement: "Vrai." }, () => fireEvent.click(screen.getByRole("button", { name: "Faux" })), { value: true }, ["C'était vrai."]],
      [
        { id: "e", itemTitle: "x", type: "mental_math", question: "8 + 5" },
        () => fireEvent.change(screen.getByRole("textbox", { name: "Ta réponse" }), { target: { value: "12" } }),
        { value: "13" },
        ["La bonne réponse : 13"],
      ],
      [
        { id: "e", itemTitle: "x", type: "cloze", text: "Hier, Léa {{0}}.", blankCount: 1 },
        () => fireEvent.change(screen.getByRole("textbox", { name: "Trou 1" }), { target: { value: "chante" } }),
        { values: ["chantait"] },
        ["Le mot qui manquait : chantait"],
      ],
      [
        { id: "e", itemTitle: "x", type: "cloze", text: "{{0}}, Léa {{1}}.", blankCount: 2 },
        () => {
          fireEvent.change(screen.getByRole("textbox", { name: "Trou 1" }), { target: { value: "Hier" } });
          fireEvent.change(screen.getByRole("textbox", { name: "Trou 2" }), { target: { value: "chante" } });
        },
        { values: ["Hier", "chantait"] },
        ["Les mots qui manquaient : Hier, chantait"],
      ],
      [
        { id: "e", itemTitle: "x", type: "reordering", elements: ["b", "a", "c"] },
        () => ["b", "a", "c"].forEach((name) => fireEvent.click(screen.getByRole("button", { name }))),
        { order: ["a", "b", "c"] },
        ["Le bon ordre : a, b, c"],
      ],
      [
        { id: "e", itemTitle: "x", type: "matching", lefts: ["Hier", "Demain"], rights: ["chantera", "chantait"] },
        () => {
          fireEvent.click(screen.getByRole("button", { name: "Hier" }));
          fireEvent.click(screen.getByRole("button", { name: "chantera" }));
          fireEvent.click(screen.getByRole("button", { name: "Demain" }));
          fireEvent.click(screen.getByRole("button", { name: "chantait" }));
        },
        { pairs: [{ left: "Hier", right: "chantait" }, { left: "Demain", right: "chantera" }] },
        ["Les bonnes paires :", "Hier → chantait", "Demain → chantera"],
      ],
    ];
    for (const [exercise, answer, correction, lines] of cases) {
      wrong(correction);
      await answerWrong(exercise, answer);
      const status = screen.getByRole("status");
      for (const line of lines) expect(status, line).toHaveTextContent(line);
      cleanup();
    }
  });

  it("the flash dictation gives back its word", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    wrong({ text: "chanter" });
    renderGame({ id: "e", itemTitle: "x", type: "delayed_copy", wordOrPhrase: "chanter", displayDurationMs: 1000 });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Écris le mot" }), { target: { value: "chanté" } });
    fireEvent.click(screen.getByRole("button", { name: "Valider" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Le mot était : chanter");
  });

  it("a right answer shows nothing more than the mascot's joy", async () => {
    api.answerExercise.mockResolvedValue({ units: [{ id: "0", correct: true }] });
    renderGame({ id: "e", itemTitle: "x", type: "true_false", statement: "Vrai." });
    fireEvent.click(screen.getByRole("button", { name: "Vrai" }));
    fireEvent.click(screen.getByRole("button", { name: "Valider" }));

    await screen.findByText(/Bravo !|Bien joué !|C'est ça !/);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
