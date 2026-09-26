// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MainScreens } from "./MainScreens.js";

const api = vi.hoisted(() => ({
  listCourses: vi.fn(),
  getUnconfirmedCourse: vi.fn(),
  createCourse: vi.fn(),
  uploadPage: vi.fn(),
  startExtraction: vi.fn(),
  getCourse: vi.fn(),
  confirmCourse: vi.fn(),
  rejectCourse: vi.fn(),
  retryExtraction: vi.fn(),
  pageFileUrl: () => "/api/courses/c1/pages/0/file",
  pollInterval: () => false as const,
}));
vi.mock("../lib/courses.js", () => api);

const running = { id: "c1", title: "", subject: null, grade: "CM1", color: "", extractionStatus: "running", confirmed: false, pageCount: 1, createdAt: "", lastAccessedAt: "" };

beforeEach(() => {
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => "blob:thumb"), revokeObjectURL: vi.fn() }));
  api.listCourses.mockResolvedValue([]);
  api.getUnconfirmedCourse.mockResolvedValue(null);
  api.createCourse.mockResolvedValue("c1");
  api.uploadPage.mockResolvedValue({ ok: true, index: 0 });
  api.startExtraction.mockResolvedValue(undefined);
  api.getCourse.mockResolvedValue(running);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderMain() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MainScreens firstName="Léa" onLogout={vi.fn()} reencode={(file) => Promise.resolve(new Blob([file]))} />
    </QueryClientProvider>,
  );
}

describe("MainScreens: from capture to the course, and back", () => {
  it("« C'est tout ! » opens the course being read; « Retour à l'accueil » leaves it", async () => {
    renderMain();
    await screen.findByRole("button", { name: "Photographier un cours" });
    fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [new File(["a"], "a.jpg")] } });
    await screen.findByRole("img", { name: "Page 1" });

    fireEvent.click(screen.getByRole("button", { name: "C'est tout !" }));

    expect(await screen.findByText(/Je regarde ta photo…|Je lis ta leçon…/)).toBeInTheDocument();
    // The loading state shows the same sentence before the query runs:
    // wait for the call itself, not for the text (flaky under load).
    await waitFor(() => expect(api.getCourse).toHaveBeenCalledWith("c1"));
    fireEvent.click(screen.getByRole("button", { name: "Retour à l'accueil" }));
    expect(await screen.findByRole("button", { name: "Photographier un cours" })).toBeInTheDocument();
  });

  it("the home banner opens the pending course", async () => {
    api.getUnconfirmedCourse.mockResolvedValue(running);
    renderMain();

    fireEvent.click(await screen.findByRole("button", { name: "Je regarde encore ta photo…" }));

    expect(await screen.findByRole("button", { name: "Retour à l'accueil" })).toBeInTheDocument();
    await waitFor(() => expect(api.getCourse).toHaveBeenCalledWith("c1"));
  });
});
