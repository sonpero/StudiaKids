// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HomeScreen } from "./HomeScreen.js";

const api = vi.hoisted(() => ({ listCourses: vi.fn(), getUnconfirmedCourse: vi.fn(() => Promise.resolve(null)), pollInterval: () => false as const }));
vi.mock("../lib/courses.js", () => api);
vi.mock("../lib/progress.js", () => ({ getProgress: () => Promise.resolve({ total: 48, currentStreak: 0, bestStreak: 0 }), starsLabel: () => "48 étoiles" }));

afterEach(() => {
  cleanup();
  api.listCourses.mockReset();
});

const course = (id: string, title: string, subject: string, color: string, exerciseCount: number, lastAccessedAt = "2026-09-26T10:00:00.000Z") => ({
  id,
  title,
  subject,
  grade: "CM1",
  color,
  extractionStatus: "ready",
  extractionStarted: true,
  confirmed: true,
  pageCount: 1,
  createdAt: "2026-09-26T10:00:00.000Z",
  lastAccessedAt,
  exerciseCount,
});

function renderHome() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <HomeScreen firstName="Léa" onPhoto={vi.fn()} onLogout={vi.fn()} onAskCourse={vi.fn()} />
    </QueryClientProvider>,
  );
}

const has = (element: Element | null, ...tokens: string[]) => {
  for (const token of tokens) expect(element?.className.split(/\s+/), token).toContain(token);
};

// docs/design/accueil.png.
describe("HomeScreen, as drawn in docs/design/accueil.png", () => {
  it("the mascot and its sentence stand in a turquoise hero card, the sentence in a speech bubble", async () => {
    api.listCourses.mockResolvedValue([]);
    renderHome();
    const line = await screen.findByText(/Prends ta leçon en photo|Aucun cours/);
    const hero = screen.getByTestId("hero");
    has(hero, "bg-turquoise", "border-3", "rounded-grande-carte", "shadow-grande-carte");
    expect(within(hero).getByTestId("mascot")).toBeInTheDocument();
    expect(hero).toContainElement(line);
    has(line.closest("[data-bubble]"), "bg-white", "border-3", "rounded-carte");
  });

  it("the photo button is the primary action, with a camera icon", async () => {
    api.listCourses.mockResolvedValue([]);
    renderHome();
    const photo = await screen.findByRole("button", { name: "Photographier un cours" });
    has(photo, "bg-mandarine", "shadow-primaire", "rounded-carte");
    expect(photo.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("each course: a card with its subject's initials, its title, and subject · grade · games on one line", async () => {
    api.listCourses.mockResolvedValue([course("c1", "Les fractions", "maths", "matiere-maths", 12), course("c2", "Les Gaulois", "history", "matiere-histoire", 0, "2026-01-01T10:00:00.000Z")]);
    renderHome();
    const card = await screen.findByRole("button", { name: /Les fractions/ });
    has(card, "border-3", "rounded-carte", "bg-white", "shadow-moyenne");
    expect(card.querySelector("[data-subject-chip]")).toHaveTextContent("Ma");
    expect(within(card).getByText("Maths · CM1 · 12 jeux prêts")).toBeInTheDocument();
    expect(within(screen.getByRole("button", { name: /Les Gaulois/ })).getByText("Histoire · CM1")).toBeInTheDocument();
  });

  it("the greeting is the screen's title, the star pill beside it", async () => {
    api.listCourses.mockResolvedValue([]);
    renderHome();
    has(screen.getByRole("heading", { name: "Salut Léa !", level: 1 }), "font-display", "text-titre");
    expect(await screen.findByTestId("star-counter")).toBeInTheDocument();
  });
});
