// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlayScreen } from "./PlayScreen.js";
import { SessionSummary } from "./SessionSummary.js";

const api = vi.hoisted(() => ({ listPlayableExercises: vi.fn(), answerExercise: vi.fn(), gameLabel: (type: string) => ({ mcq: "Quiz" })[type] ?? type }));
vi.mock("../lib/play.js", () => api);
vi.mock("../lib/generation.js", () => ({ getGenerationStatus: vi.fn(() => Promise.resolve({ status: "not_started", done: 0, total: 0, failed: 0, itemCount: 0 })), startGeneration: vi.fn(), generationPollInterval: () => false }));
const progress = vi.hoisted(() => ({ getProgress: vi.fn(), starsLabel: (n: number) => `${String(n)} étoiles` }));
vi.mock("../lib/progress.js", () => progress);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
const has = (element: Element | null | undefined, ...tokens: string[]) => {
  for (const token of tokens) expect(element?.className.split(/\s+/), token).toContain(token);
};
const client = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });
function renderPlay() {
  render(
    <QueryClientProvider client={client()}>
      <PlayScreen courseId="c1" onHome={vi.fn()} onPhoto={vi.fn()} />
    </QueryClientProvider>,
  );
}

// No mockup: the mockups' language (docs/design/*.png, tokens.md).
describe("PlayScreen, in the mockups' language", () => {
  it("each game a card; the advised one wears a turquoise pill", async () => {
    api.listPlayableExercises.mockResolvedValue({ exercises: [{ id: "e1", itemTitle: "Le verbe", type: "mcq", question: "?", options: ["a", "b"] }], nextExerciseId: "e1" });
    renderPlay();
    const game = await screen.findByRole("button", { name: /Quiz/ });
    has(game, "rounded-carte", "border-3", "bg-white", "shadow-moyenne");
    has(screen.getByText("À toi de jouer !"), "rounded-pastille", "bg-turquoise");
  });

  it("no game yet: the mascot says it in its bubble", async () => {
    api.listPlayableExercises.mockResolvedValue({ exercises: [], nextExerciseId: null });
    renderPlay();
    expect((await screen.findByText("Pas encore de jeux pour ce cours.")).hasAttribute("data-bubble")).toBe(true);
  });

  it("the summary: its line as a title in a card", async () => {
    progress.getProgress.mockResolvedValue({ total: 5, currentStreak: 0, bestStreak: 0, starsSince: 2, successesSince: 2 });
    render(
      <QueryClientProvider client={client()}>
        <SessionSummary since="2026-09-27T10:00:00.000Z" onMore={vi.fn()} onHome={vi.fn()} />
      </QueryClientProvider>,
    );
    const line = await screen.findByText(/Bravo, tu as gagné 2 étoiles/);
    has(line, "font-display", "text-titre");
    has(line.closest("[data-summary]"), "rounded-grande-carte", "border-3", "bg-white", "shadow-grande-carte");
  });
});
