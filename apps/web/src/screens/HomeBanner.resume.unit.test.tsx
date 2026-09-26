// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HomeScreen } from "./HomeScreen.js";

const api = vi.hoisted(() => ({ listCourses: vi.fn(), getUnconfirmedCourse: vi.fn(), pollInterval: () => false as const }));
vi.mock("../lib/courses.js", () => api);

afterEach(() => {
  cleanup();
  api.listCourses.mockReset();
  api.getUnconfirmedCourse.mockReset();
});

const leftOnCapture = {
  id: "c9",
  title: "",
  subject: null,
  grade: "CM1",
  color: "",
  extractionStatus: "pending",
  extractionStarted: false,
  confirmed: false,
  pageCount: 2,
  createdAt: "2026-09-26T10:00:00.000Z",
  lastAccessedAt: "2026-09-26T10:00:00.000Z",
};

// docs/ui.md, "Accueil": photos taken but never sent to reading (the child
// left before « C'est tout ! ») — the banner says so and resumes the capture.
describe("HomeScreen banner, reading never launched", () => {
  it("says the photos are not finished, and a tap resumes the capture of that course", async () => {
    api.listCourses.mockResolvedValue([]);
    api.getUnconfirmedCourse.mockResolvedValue(leftOnCapture);
    const onResumeCapture = vi.fn();
    const onOpenCourse = vi.fn();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <HomeScreen firstName="Léa" onPhoto={vi.fn()} onLogout={vi.fn()} onOpenCourse={onOpenCourse} onResumeCapture={onResumeCapture} />
      </QueryClientProvider>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Tu n'as pas fini tes photos. On continue ?" }));

    expect(onResumeCapture).toHaveBeenCalledWith(expect.objectContaining({ id: "c9", pageCount: 2 }));
    expect(onOpenCourse).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Je regarde encore ta photo…" })).not.toBeInTheDocument();
  });
});
