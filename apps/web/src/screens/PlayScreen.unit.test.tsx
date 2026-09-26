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
const progress = vi.hoisted(() => ({ getProgress: vi.fn(), starsLabel: (n: number) => `${String(n)} étoiles` }));
vi.mock("../lib/progress.js", () => progress);

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

  // M5 (session decision): after the last game of the list, « Jeu
  // suivant » ends the session with its summary instead of looping back.
  it("« Jeu suivant » opens the next game of the list", async () => {
    api.listPlayableExercises.mockResolvedValue(games);
    api.answerExercise.mockResolvedValue({ units: [{ id: "0", correct: true }] });
    renderPlay();

    fireEvent.click(await screen.findByRole("button", { name: /Quiz/ }));
    fireEvent.click(screen.getByRole("button", { name: "chante" }));
    fireEvent.click(screen.getByRole("button", { name: "Valider" }));
    fireEvent.click(await screen.findByRole("button", { name: "Jeu suivant" }));

    expect(await screen.findByRole("heading", { name: "Vrai ou faux", level: 1 })).toBeInTheDocument();
  });
});

// docs/ui.md, M5: a session goes from entering Jouer to « J'ai fini », or
// to « Jeu suivant » after the last game; its summary shows only gains.
describe("PlayScreen, the session summary", () => {
  it("« J'ai fini » shows what was won since entering Jouer: stars and right answers, never a mistake", async () => {
    api.listPlayableExercises.mockResolvedValue(games);
    progress.getProgress.mockResolvedValue({ total: 9, currentStreak: 0, bestStreak: 3, starsSince: 2, successesSince: 3 });
    const before = new Date().toISOString();
    renderPlay();

    fireEvent.click(await screen.findByRole("button", { name: "J'ai fini" }));

    expect(await screen.findByText("Bravo, tu as gagné 2 étoiles !")).toBeInTheDocument();
    expect(screen.getByText("3 bonnes réponses")).toBeInTheDocument();
    expect(screen.getByTestId("mascot")).toHaveAttribute("data-pose", "joy");
    const since = progress.getProgress.mock.calls.at(-1)?.[0] as string;
    expect(since >= before && since <= new Date().toISOString()).toBe(true);
    expect(screen.queryByText(/erreur|faux|raté|manqué/i)).not.toBeInTheDocument();
  });

  it("a session without stars ends on a kind word, and says no zero", async () => {
    api.listPlayableExercises.mockResolvedValue(games);
    progress.getProgress.mockResolvedValue({ total: 9, currentStreak: 0, bestStreak: 3, starsSince: 0, successesSince: 0 });
    renderPlay();

    fireEvent.click(await screen.findByRole("button", { name: "J'ai fini" }));

    expect(await screen.findByText("Bien joué, tu as fini !")).toBeInTheDocument();
    expect(screen.queryByText(/\b0\b/)).not.toBeInTheDocument();
  });

  it("« Jeu suivant » after the last game ends the session with its summary", async () => {
    api.listPlayableExercises.mockResolvedValue(games);
    api.answerExercise.mockResolvedValue({ units: [{ id: "0", correct: true }] });
    progress.getProgress.mockResolvedValue({ total: 9, currentStreak: 1, bestStreak: 3, starsSince: 1, successesSince: 1 });
    renderPlay();

    fireEvent.click(await screen.findByRole("button", { name: /Vrai ou faux/ }));
    fireEvent.click(screen.getByRole("button", { name: "Faux" }));
    fireEvent.click(screen.getByRole("button", { name: "Valider" }));
    fireEvent.click(await screen.findByRole("button", { name: "Jeu suivant" }));

    expect(await screen.findByText("Bravo, tu as gagné 1 étoile !")).toBeInTheDocument();
    expect(screen.getByText("1 bonne réponse")).toBeInTheDocument();
  });

  it("« Encore des jeux » starts a new session on the list; « Accueil » goes home", async () => {
    api.listPlayableExercises.mockResolvedValue(games);
    progress.getProgress.mockResolvedValue({ total: 9, currentStreak: 0, bestStreak: 3, starsSince: 1, successesSince: 1 });
    const { onHome } = renderPlay();

    fireEvent.click(await screen.findByRole("button", { name: "J'ai fini" }));
    fireEvent.click(await screen.findByRole("button", { name: "Encore des jeux" }));
    expect(await screen.findByRole("heading", { name: "Tes jeux", level: 1 })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "J'ai fini" }));
    fireEvent.click(await screen.findByRole("button", { name: "Accueil" }));

    expect(onHome).toHaveBeenCalled();
  });

  it("the summary's own states: loading, and a failure with a way to try again", async () => {
    api.listPlayableExercises.mockResolvedValue(games);
    progress.getProgress.mockReturnValueOnce(new Promise(() => undefined));
    renderPlay();
    fireEvent.click(await screen.findByRole("button", { name: "J'ai fini" }));
    expect(await screen.findByText("Je compte tes étoiles…")).toBeInTheDocument();
    cleanup();

    progress.getProgress.mockRejectedValueOnce(new Error("500")).mockResolvedValueOnce({ total: 9, currentStreak: 0, bestStreak: 3, starsSince: 1, successesSince: 1 });
    renderPlay();
    fireEvent.click(await screen.findByRole("button", { name: "J'ai fini" }));
    fireEvent.click(await screen.findByRole("button", { name: "Réessaie" }));
    expect(await screen.findByText("Bravo, tu as gagné 1 étoile !")).toBeInTheDocument();
  });
});
