// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HomeScreen } from "./HomeScreen.js";

const api = vi.hoisted(() => ({ listCourses: vi.fn(), getUnconfirmedCourse: vi.fn(() => Promise.resolve(null)), pollInterval: () => false as const }));
vi.mock("../lib/courses.js", () => api);

afterEach(() => cleanup());

const course = (id: string, title: string, exerciseCount: number) => ({
  id,
  title,
  subject: "french",
  grade: "CM1",
  color: "matiere-francais",
  extractionStatus: "ready",
  extractionStarted: true,
  confirmed: true,
  pageCount: 1,
  createdAt: "",
  lastAccessedAt: "",
  exerciseCount,
});

// docs/ui.md, M3: the card shows how many games are ready, when there are.
describe("HomeScreen, games count", () => {
  it("« 12 jeux prêts », « 1 jeu prêt », and nothing before any game", async () => {
    api.listCourses.mockResolvedValue([course("c1", "Le verbe", 12), course("c2", "Le nom", 1), course("c3", "Les fractions", 0)]);
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <HomeScreen firstName="Léa" onPhoto={vi.fn()} onLogout={vi.fn()} />
      </QueryClientProvider>,
    );

    expect(await screen.findByRole("button", { name: /Le verbe/ })).toHaveTextContent("12 jeux prêts");
    expect(screen.getByRole("button", { name: /Le nom/ })).toHaveTextContent("1 jeu prêt");
    expect(screen.getByRole("button", { name: /Les fractions/ })).not.toHaveTextContent(/prêt/);
  });
});
