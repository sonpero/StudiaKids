// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlayScreen } from "./PlayScreen.js";

const api = vi.hoisted(() => ({ listPlayableExercises: vi.fn(), answerExercise: vi.fn(), gameLabel: (type: string) => ({ mcq: "Quiz", true_false: "Vrai ou faux" })[type] ?? type }));
vi.mock("../lib/play.js", () => api);
const generation = vi.hoisted(() => ({ getGenerationStatus: vi.fn(), startGeneration: vi.fn(), generationPollInterval: () => false as const }));
vi.mock("../lib/generation.js", () => generation);

afterEach(() => {
  cleanup();
  api.listPlayableExercises.mockReset();
});

const games = {
  exercises: [
    { id: "e1", itemTitle: "Le verbe « chante »", type: "mcq", question: "Quel mot est le verbe ?", options: ["Léa", "chante", "une", "chanson"] },
    { id: "e2", itemTitle: "Définition de l'infinitif", type: "true_false", statement: "L'infinitif change tout le temps." },
  ],
  nextExerciseId: "e2",
};

function renderPlay() {
  const onHome = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <PlayScreen courseId="c1" onHome={onHome} onPhoto={vi.fn()} />
    </QueryClientProvider>,
  );
  return { onHome };
}

// docs/ui.md, "Jouer (M4)" and "États requis".
describe("PlayScreen", () => {
  it("loading: the waiting mascot and a short sentence", () => {
    api.listPlayableExercises.mockReturnValue(new Promise(() => undefined));
    renderPlay();

    expect(screen.getByTestId("mascot")).toHaveAttribute("data-pose", "waiting");
    expect(screen.getByText("Je cherche tes jeux…")).toBeInTheDocument();
  });

  it("error: the glitch mascot, a child's sentence, and « Réessaie » reads again", async () => {
    api.listPlayableExercises.mockRejectedValueOnce(new Error("500")).mockResolvedValueOnce(games);
    renderPlay();

    expect(await screen.findByText("Oh, quelque chose a coincé. On réessaie ?")).toBeInTheDocument();
    expect(screen.getByTestId("mascot")).toHaveAttribute("data-pose", "glitch");
    fireEvent.click(screen.getByRole("button", { name: "Réessaie" }));
    expect(await screen.findByRole("heading", { name: "Tes jeux", level: 1 })).toBeInTheDocument();
  });

  it("empty: a sentence and « Créer mes jeux » at hand", async () => {
    api.listPlayableExercises.mockResolvedValue({ exercises: [], nextExerciseId: null });
    generation.getGenerationStatus.mockResolvedValue({ status: "not_started", done: 0, total: 0, failed: 0, itemCount: 0 });
    renderPlay();

    expect(await screen.findByText("Pas encore de jeux pour ce cours.")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Créer mes jeux" })).toBeInTheDocument();
  });

  it("a course deleted meanwhile goes home", async () => {
    api.listPlayableExercises.mockResolvedValue(null);
    const { onHome } = renderPlay();

    await waitFor(() => expect(onHome).toHaveBeenCalled());
  });

  it("ready: each game with its name and its item, the next one marked « À toi de jouer ! »", async () => {
    api.listPlayableExercises.mockResolvedValue(games);
    renderPlay();

    expect(await screen.findByRole("heading", { name: "Tes jeux", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Quiz.*Le verbe « chante »/ })).not.toHaveTextContent("À toi de jouer !");
    expect(screen.getByRole("button", { name: /Vrai ou faux.*Définition de l'infinitif/ })).toHaveTextContent("À toi de jouer !");
  });

  it("a tap opens the game; « Tous les jeux » comes back to the list", async () => {
    api.listPlayableExercises.mockResolvedValue(games);
    renderPlay();

    fireEvent.click(await screen.findByRole("button", { name: /Quiz/ }));
    expect(screen.getByRole("heading", { name: "Quiz", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Quel mot est le verbe ?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tous les jeux" }));
    expect(await screen.findByRole("heading", { name: "Tes jeux", level: 1 })).toBeInTheDocument();
  });

  it("« Jeu suivant » opens the next game of the list, back to the first after the last", async () => {
    api.listPlayableExercises.mockResolvedValue(games);
    api.answerExercise.mockResolvedValue({ units: [{ id: "0", correct: true }] });
    renderPlay();

    fireEvent.click(await screen.findByRole("button", { name: /Vrai ou faux/ }));
    fireEvent.click(screen.getByRole("button", { name: "Faux" }));
    fireEvent.click(screen.getByRole("button", { name: "Valider" }));
    fireEvent.click(await screen.findByRole("button", { name: "Jeu suivant" }));

    expect(await screen.findByRole("heading", { name: "Quiz", level: 1 })).toBeInTheDocument();
  });
});
