// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import type { PlayableExerciseDto } from "@studiakids/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameScreen } from "./GameScreen.js";

const api = vi.hoisted(() => ({ answerExercise: vi.fn(), gameLabel: (type: string) => type }));
vi.mock("../lib/play.js", () => api);

afterEach(() => {
  cleanup();
  api.answerExercise.mockReset();
});

function renderGame(exercise: PlayableExerciseDto) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <GameScreen exercise={exercise} onNext={vi.fn()} onBack={vi.fn()} />
    </QueryClientProvider>,
  );
}

const tap = (name: string) => fireEvent.click(screen.getByRole("button", { name }));
const valider = () => screen.getByRole("button", { name: "Valider" });

// docs/ui.md, "Jouer (M4)": no drag and drop — tap a left item then its
// answer; tap the elements in order, a second tap takes one back.
describe("GameScreen, matching", () => {
  const matching: PlayableExerciseDto = { id: "e1", itemTitle: "Les temps", type: "matching", lefts: ["Hier", "Aujourd'hui", "Demain"], rights: ["Léa chante", "Léa chantera", "Léa chantait"] };

  it("pairs a tapped left item with the answer tapped next, and shows the pair", () => {
    renderGame(matching);

    tap("Hier");
    expect(screen.getByRole("button", { name: "Hier" })).toHaveAttribute("aria-pressed", "true");
    tap("Léa chantait");

    expect(screen.getByRole("button", { name: "Hier" })).toHaveAttribute("aria-pressed", "false");
    expect(within(screen.getByRole("list", { name: "Les éléments à relier" })).getByText("Hier → Léa chantait")).toBeInTheDocument();
  });

  it("« Valider » waits for every left item to be paired, then sends the pairs", async () => {
    api.answerExercise.mockResolvedValue({ units: [{ id: "0", correct: true }, { id: "1", correct: true }, { id: "2", correct: true }] });
    renderGame(matching);

    tap("Hier");
    tap("Léa chantait");
    tap("Aujourd'hui");
    tap("Léa chante");
    expect(valider()).toBeDisabled();
    tap("Demain");
    tap("Léa chantera");
    fireEvent.click(valider());

    expect(await screen.findByText(/Bravo !|Bien joué !|C'est ça !/)).toBeInTheDocument();
    expect(api.answerExercise).toHaveBeenCalledWith(
      "e1",
      {
        pairs: [
          { left: "Hier", right: "Léa chantait" },
          { left: "Aujourd'hui", right: "Léa chante" },
          { left: "Demain", right: "Léa chantera" },
        ],
      },
      false,
    );
  });

  it("an answer used again moves to its new item; an item paired again takes its new answer", () => {
    renderGame(matching);

    tap("Hier");
    tap("Léa chante");
    tap("Demain");
    tap("Léa chante");
    tap("Hier");
    tap("Léa chantait");

    const pairs = within(screen.getByRole("list", { name: "Les éléments à relier" }));
    expect(pairs.getByText("Hier → Léa chantait")).toBeInTheDocument();
    expect(pairs.getByText("Demain → Léa chante")).toBeInTheDocument();
    expect(pairs.queryByText(/Aujourd'hui →/)).not.toBeInTheDocument();
  });

  it("an answer tapped with no item chosen does nothing", () => {
    renderGame(matching);

    tap("Léa chante");

    expect(within(screen.getByRole("list", { name: "Les éléments à relier" })).queryByText(/→/)).not.toBeInTheDocument();
  });
});

describe("GameScreen, reordering", () => {
  const reordering: PlayableExerciseDto = { id: "e2", itemTitle: "Les temps", type: "reordering", elements: ["Demain", "Hier", "Aujourd'hui"] };

  it("tapped elements go, in that order, to the child's order; a second tap takes one back", () => {
    renderGame(reordering);

    tap("Demain");
    tap("Hier");
    const order = within(screen.getByRole("list", { name: "Ton ordre" }));
    expect(order.getAllByRole("button").map((button) => button.getAttribute("aria-label"))).toEqual(["1. Demain", "2. Hier"]);

    tap("1. Demain");

    expect(order.getAllByRole("button").map((button) => button.getAttribute("aria-label"))).toEqual(["1. Hier"]);
    expect(screen.getByRole("button", { name: "Demain" })).toBeInTheDocument();
  });

  it("« Valider » waits for every element to be placed, then sends the order", async () => {
    api.answerExercise.mockResolvedValue({ units: [{ id: "0", correct: false }, { id: "1", correct: false }, { id: "2", correct: true }] });
    renderGame(reordering);

    tap("Aujourd'hui");
    tap("Hier");
    expect(valider()).toBeDisabled();
    tap("Demain");
    fireEvent.click(valider());

    expect(await screen.findByText(/Pas tout à fait\. Essaie encore !|Presque ! On continue \?/)).toBeInTheDocument();
    expect(api.answerExercise).toHaveBeenCalledWith("e2", { order: ["Aujourd'hui", "Hier", "Demain"] }, false);
  });
});
