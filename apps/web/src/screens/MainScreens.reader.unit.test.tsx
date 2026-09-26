// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

const verbe = { id: "c1", title: "Le verbe", subject: "french", grade: "CM1", color: "matiere-francais", extractionStatus: "ready", extractionStarted: true, confirmed: true, pageCount: 1, createdAt: "", lastAccessedAt: "", exerciseCount: 0 };

beforeEach(() => {
  api.listCourses.mockResolvedValue([verbe]);
  api.getUnconfirmedCourse.mockResolvedValue(null);
  reader.getCourseText.mockResolvedValue({ markdown: "# Le verbe\n\nLe verbe indique ce que fait le sujet.", speech: "", photos: [{ index: 0 }] });
});

afterEach(() => cleanup());

// docs/ui.md, "Lire un cours et créer ses jeux (M3)".
describe("MainScreens: a course card opens the reader", () => {
  it("a tap on « Le verbe » opens its text; « Accueil » comes back to the list", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MainScreens firstName="Léa" onLogout={vi.fn()} reencode={(file) => Promise.resolve(new Blob([file]))} />
      </QueryClientProvider>,
    );

    fireEvent.click(await screen.findByRole("button", { name: /Le verbe/ }));

    expect(await screen.findByText("Le verbe indique ce que fait le sujet.")).toBeInTheDocument();
    expect(reader.getCourseText).toHaveBeenCalledWith("c1");
    fireEvent.click(screen.getByRole("button", { name: "Accueil" }));
    expect(await screen.findByRole("heading", { name: "Mes cours" })).toBeInTheDocument();
  });
});
