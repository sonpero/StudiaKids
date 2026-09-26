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
  pageFileUrl: (id: string, index: number) => `/api/courses/${id}/pages/${String(index)}/file`,
  pollInterval: () => false as const,
}));
vi.mock("../lib/courses.js", () => api);

const leftOnCapture = { id: "c9", title: "", subject: null, grade: "CM1", color: "", extractionStatus: "pending", extractionStarted: false, confirmed: false, pageCount: 2, createdAt: "", lastAccessedAt: "" };

beforeEach(() => {
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => "blob:thumb"), revokeObjectURL: vi.fn() }));
  api.listCourses.mockResolvedValue([]);
  api.getUnconfirmedCourse.mockResolvedValue(leftOnCapture);
  api.uploadPage.mockResolvedValue({ ok: true, index: 2 });
  api.startExtraction.mockResolvedValue(undefined);
  api.getCourse.mockResolvedValue({ ...leftOnCapture, extractionStarted: true });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  for (const mock of [api.listCourses, api.getUnconfirmedCourse, api.createCourse, api.uploadPage, api.startExtraction, api.getCourse]) mock.mockReset();
});

function renderMain() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MainScreens firstName="Léa" onLogout={vi.fn()} reencode={(file) => Promise.resolve(new Blob([file]))} />
    </QueryClientProvider>,
  );
}

describe("MainScreens: resuming a capture left unfinished", () => {
  it("shows the pages already taken, adds new ones to the same course, and « C'est tout ! » launches its reading", async () => {
    renderMain();

    fireEvent.click(await screen.findByRole("button", { name: "Tu n'as pas fini tes photos. On continue ?" }));

    expect(await screen.findByRole("img", { name: "Page 1" })).toHaveAttribute("src", "/api/courses/c9/pages/0/file");
    expect(screen.getByRole("img", { name: "Page 2" })).toHaveAttribute("src", "/api/courses/c9/pages/1/file");
    fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [new File(["c"], "c.jpg")] } });
    expect(await screen.findByRole("img", { name: "Page 3" })).toBeInTheDocument();
    expect(api.createCourse).not.toHaveBeenCalled();
    expect(api.uploadPage).toHaveBeenCalledWith("c9", expect.any(Blob));

    fireEvent.click(screen.getByRole("button", { name: "C'est tout !" }));
    await waitFor(() => expect(api.startExtraction).toHaveBeenCalledWith("c9"));
  });
});
