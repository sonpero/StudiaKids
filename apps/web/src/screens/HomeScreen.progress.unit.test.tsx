// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HomeScreen } from "./HomeScreen.js";

const api = vi.hoisted(() => ({ listCourses: vi.fn(), getUnconfirmedCourse: vi.fn(() => Promise.resolve(null)), pollInterval: () => false as const }));
vi.mock("../lib/courses.js", () => api);
const progress = vi.hoisted(() => ({ getProgress: vi.fn(() => Promise.resolve({ total: 7, currentStreak: 0, bestStreak: 2 })), starsLabel: (n: number) => `${String(n)} étoiles` }));
vi.mock("../lib/progress.js", () => progress);

afterEach(() => cleanup());

const course = (id: string, title: string, lastAccessedAt: string, exerciseCount: number) => ({
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
  lastAccessedAt,
  exerciseCount,
});

function renderHome() {
  const onPlayCourse = vi.fn();
  const onReadCourse = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <HomeScreen firstName="Léa" onPhoto={vi.fn()} onLogout={vi.fn()} onPlayCourse={onPlayCourse} onReadCourse={onReadCourse} />
    </QueryClientProvider>,
  );
  return { onPlayCourse, onReadCourse };
}

// docs/ui.md, M5: the star counter on the home, and resuming the last
// course opened (its lastAccessedAt), even after logging in again: its
// card carries « On reprend ? ».
describe("HomeScreen, stars and resuming", () => {
  it("shows the star counter", async () => {
    api.listCourses.mockResolvedValue([]);
    renderHome();

    expect(await screen.findByTestId("star-counter")).toHaveAccessibleName("7 étoiles");
  });

  it("offers the last course opened; a tap opens Jouer when it has games", async () => {
    api.listCourses.mockResolvedValue([
      course("c1", "Les fractions", "2026-09-26T09:00:00.000Z", 4),
      course("c2", "Le passé composé", "2026-09-26T10:00:00.000Z", 2),
      course("c3", "Le verbe", "2026-09-25T10:00:00.000Z", 0),
    ]);
    const { onPlayCourse } = renderHome();

    const resume = await screen.findByRole("button", { name: /On reprend \?/ });
    expect(resume).toHaveTextContent("Le passé composé");
    expect(screen.getAllByText("On reprend ?")).toHaveLength(1);
    fireEvent.click(resume);

    expect(onPlayCourse).toHaveBeenCalledWith("c2");
  });

  it("a last course without games opens Lire", async () => {
    api.listCourses.mockResolvedValue([course("c3", "Le verbe", "2026-09-26T10:00:00.000Z", 0)]);
    const { onReadCourse } = renderHome();

    fireEvent.click(await screen.findByRole("button", { name: /Le verbe.*On reprend \?/ }));

    expect(onReadCourse).toHaveBeenCalledWith("c3");
  });

  it("no course, nothing to resume", async () => {
    api.listCourses.mockResolvedValue([]);
    renderHome();

    await screen.findByTestId("star-counter");
    expect(screen.queryByRole("button", { name: /On reprend/ })).not.toBeInTheDocument();
  });
});
