// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MainScreens } from "./MainScreens.js";

const api = vi.hoisted(() => ({
  listCourses: vi.fn(),
  getUnconfirmedCourse: vi.fn(),
  getCourse: vi.fn(),
  pageFileUrl: (id: string, index: number) => `/api/courses/${id}/pages/${String(index)}/file`,
  pollInterval: () => false as const,
}));
vi.mock("../lib/courses.js", () => api);
const reader = vi.hoisted(() => ({ getCourseText: vi.fn() }));
vi.mock("../lib/reader.js", () => reader);
const play = vi.hoisted(() => ({ listPlayableExercises: vi.fn(), answerExercise: vi.fn(), gameLabel: () => "Vrai ou faux" }));
vi.mock("../lib/play.js", () => play);

const course = (exerciseCount: number) => ({ id: "c1", title: "Le verbe", subject: "french", grade: "CM1", color: "matiere-francais", extractionStatus: "ready", extractionStarted: true, confirmed: true, pageCount: 1, createdAt: "", lastAccessedAt: "", exerciseCount });

beforeEach(() => {
  api.getUnconfirmedCourse.mockResolvedValue(null);
  reader.getCourseText.mockResolvedValue({ markdown: "Le verbe indique ce que fait le sujet.", speech: "", photos: [] });
  play.listPlayableExercises.mockResolvedValue({ exercises: [{ id: "e1", itemTitle: "L'infinitif", type: "true_false", statement: "Vrai." }], nextExerciseId: "e1" });
});

afterEach(() => cleanup());

function renderMain() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MainScreens firstName="Léa" onLogout={vi.fn()} reencode={(file) => Promise.resolve(new Blob([file]))} />
    </QueryClientProvider>,
  );
}

// docs/ui.md, "Jouer (M4)": a card with games ready opens Jouer; the tab
// bar moves between Lire, Jouer and Accueil for this course.
describe("MainScreens: the Jouer tab", () => {
  it("a card with games ready opens Jouer, with the tab bar", async () => {
    api.listCourses.mockResolvedValue([course(12)]);
    renderMain();

    fireEvent.click(await screen.findByRole("button", { name: /Le verbe/ }));

    expect(await screen.findByRole("heading", { name: "Tes jeux", level: 1 })).toBeInTheDocument();
    expect(play.listPlayableExercises).toHaveBeenCalledWith("c1");
    expect(within(screen.getByRole("navigation", { name: "Onglets" })).getByRole("button", { name: "Jouer" })).toHaveAttribute("aria-current", "page");
  });

  it("the tabs move between Lire and Jouer, and back home; a single « Accueil » button", async () => {
    api.listCourses.mockResolvedValue([course(0)]);
    renderMain();
    fireEvent.click(await screen.findByRole("button", { name: /Le verbe/ }));
    expect(await screen.findByText("Le verbe indique ce que fait le sujet.")).toBeInTheDocument();

    const tabs = within(screen.getByRole("navigation", { name: "Onglets" }));
    fireEvent.click(tabs.getByRole("button", { name: "Jouer" }));
    expect(await screen.findByRole("heading", { name: "Tes jeux", level: 1 })).toBeInTheDocument();
    fireEvent.click(tabs.getByRole("button", { name: "Lire" }));
    expect(await screen.findByText("Le verbe indique ce que fait le sujet.")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Accueil" })).toHaveLength(1);
    fireEvent.click(tabs.getByRole("button", { name: "Accueil" }));
    expect(await screen.findByRole("heading", { name: "Mes cours" })).toBeInTheDocument();
  });
});
