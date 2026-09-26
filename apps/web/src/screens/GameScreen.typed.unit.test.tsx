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

const valider = () => screen.getByRole("button", { name: "Valider" });
const RIGHT = /Bravo !|Bien joué !|C'est ça !/;

describe("GameScreen, cloze", () => {
  const cloze: PlayableExerciseDto = { id: "e1", itemTitle: "Les temps", type: "cloze", text: "Hier, Léa {{0}}. Demain, elle {{1}}.", blankCount: 2 };

  it("shows the text with a field for each blank, in place, and sends the values once all are filled", async () => {
    api.answerExercise.mockResolvedValue({ units: [{ id: "0", correct: true }, { id: "1", correct: true }] });
    renderGame(cloze);

    expect(screen.getByText(/Hier, Léa/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Trou 1" }), { target: { value: "chantait" } });
    expect(valider()).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox", { name: "Trou 2" }), { target: { value: "chantera" } });
    fireEvent.click(valider());

    expect(await screen.findByText(RIGHT)).toBeInTheDocument();
    expect(api.answerExercise).toHaveBeenCalledWith("e1", { values: ["chantait", "chantera"] }, false);
  });

  it("a blank of spaces only is not filled", () => {
    renderGame(cloze);

    fireEvent.change(screen.getByRole("textbox", { name: "Trou 1" }), { target: { value: "chantait" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Trou 2" }), { target: { value: "   " } });

    expect(valider()).toBeDisabled();
  });
});

describe("GameScreen, mental calculation", () => {
  it("shows the calculation, a numeric field, and sends what was typed", async () => {
    api.answerExercise.mockResolvedValue({ units: [{ id: "0", correct: true }] });
    renderGame({ id: "e2", itemTitle: "Additions", type: "mental_math", question: "8 + 5" });

    expect(screen.getByText("8 + 5")).toBeInTheDocument();
    const field = screen.getByRole("textbox", { name: "Ta réponse" });
    expect(field).toHaveAttribute("inputmode", "decimal");
    expect(valider()).toBeDisabled();
    fireEvent.change(field, { target: { value: "13" } });
    fireEvent.click(valider());

    expect(await screen.findByText(RIGHT)).toBeInTheDocument();
    expect(api.answerExercise).toHaveBeenCalledWith("e2", { value: "13" }, false);
  });
});

// docs/modules/game-engine.md, "Copie différée", and docs/ui.md.
describe("GameScreen, flash dictation", () => {
  const flash: PlayableExerciseDto = { id: "e3", itemTitle: "Infinitif : chanter", type: "delayed_copy", wordOrPhrase: "chanter", displayDurationMs: 3000 };

  it("shows the word alone on the flash, the mascot watching, for exactly its duration, without countdown", () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderGame(flash);

    expect(screen.getByTestId("flash")).toHaveTextContent("chanter");
    expect(screen.getByTestId("mascot")).toHaveAttribute("data-pose", "watching");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByText(/\d/)).not.toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(2999);
    });
    expect(screen.getByTestId("flash")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(screen.queryByTestId("flash")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Écris le mot" })).toBeInTheDocument();
    expect(screen.getByTestId("mascot")).toHaveAttribute("data-pose", "waiting");
  });

  it("the field has autocorrect, autocapitalize, autocomplete and spellcheck off, on the attributes", () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderGame(flash);
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    const field = screen.getByRole("textbox", { name: "Écris le mot" });
    expect(field).toHaveAttribute("autocorrect", "off");
    expect(field).toHaveAttribute("autocapitalize", "off");
    expect(field).toHaveAttribute("autocomplete", "off");
    expect(field).toHaveAttribute("spellcheck", "false");
  });

  it("without a reread, the answer is sent star-eligible", async () => {
    api.answerExercise.mockResolvedValue({ units: [{ id: "0", correct: true }] });
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderGame(flash);
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    fireEvent.change(screen.getByRole("textbox", { name: "Écris le mot" }), { target: { value: "chanter" } });
    fireEvent.click(valider());

    expect(await screen.findByText(RIGHT)).toBeInTheDocument();
    expect(api.answerExercise).toHaveBeenCalledWith("e3", { text: "chanter" }, false);
    expect(screen.getAllByTestId("mascot")).toHaveLength(1);
  });

  it("« Je relis le mot » shows the flash again, keeps what was typed, and sends the answer as a reread", async () => {
    api.answerExercise.mockResolvedValue({ units: [{ id: "0", correct: true }] });
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderGame(flash);
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Écris le mot" }), { target: { value: "chan" } });

    fireEvent.click(screen.getByRole("button", { name: "Je relis le mot" }));
    expect(screen.getByTestId("flash")).toHaveTextContent("chanter");
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    const field = screen.getByRole("textbox", { name: "Écris le mot" });
    expect(field).toHaveValue("chan");
    fireEvent.change(field, { target: { value: "chanter" } });
    fireEvent.click(valider());

    expect(await screen.findByText(RIGHT)).toBeInTheDocument();
    expect(api.answerExercise).toHaveBeenCalledWith("e3", { text: "chanter" }, true);
  });

  it("« Encore une fois » starts over with a new flash, and without the reread", async () => {
    api.answerExercise.mockResolvedValue({ units: [{ id: "0", correct: false }] });
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderGame(flash);
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    fireEvent.click(screen.getByRole("button", { name: "Je relis le mot" }));
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Écris le mot" }), { target: { value: "chanté" } });
    fireEvent.click(valider());
    fireEvent.click(await screen.findByRole("button", { name: "Encore une fois" }));

    expect(screen.getByTestId("flash")).toHaveTextContent("chanter");
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    api.answerExercise.mockResolvedValue({ units: [{ id: "0", correct: true }] });
    fireEvent.change(screen.getByRole("textbox", { name: "Écris le mot" }), { target: { value: "chanter" } });
    fireEvent.click(valider());

    expect(await screen.findByText(RIGHT)).toBeInTheDocument();
    expect(api.answerExercise).toHaveBeenLastCalledWith("e3", { text: "chanter" }, false);
  });
});
