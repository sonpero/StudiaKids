// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import type { PlayableExerciseDto } from "@studiakids/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../lib/http-error.js";
import { GameScreen } from "./GameScreen.js";

const api = vi.hoisted(() => ({ answerExercise: vi.fn(), gameLabel: () => "Quiz" }));
vi.mock("../lib/play.js", () => api);

afterEach(() => {
  cleanup();
  api.answerExercise.mockReset();
});

const mcq: PlayableExerciseDto = { id: "e1", itemTitle: "Le verbe", type: "mcq", question: "Quel mot est le verbe ?", options: ["Léa", "chante", "une", "chanson"] };

// A game left open on another device while its course was deleted
// (2026-10-04): the next answer gets a 404, and the game closes quietly —
// no glitch, no endless « Réessaie » (docs/ui.md: a course gone meanwhile
// goes back silently).
describe("GameScreen, its course deleted meanwhile", () => {
  it("a 404 on the answer leaves the game without any error shown", async () => {
    api.answerExercise.mockRejectedValue(new HttpError(404, "POST /api/exercises/:id/answer"));
    const onBack = vi.fn();
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
        <GameScreen exercise={mcq} onNext={vi.fn()} onBack={onBack} />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "chante" }));
    fireEvent.click(screen.getByRole("button", { name: "Valider" }));

    await waitFor(() => expect(onBack).toHaveBeenCalled());
    expect(screen.queryByText(/coincé/)).not.toBeInTheDocument();
  });
});
