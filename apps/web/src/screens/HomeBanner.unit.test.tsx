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

const pending = (extractionStatus: string, pageCount = 1) => ({
  id: "c9",
  title: "",
  subject: null,
  grade: "CM1",
  color: "",
  extractionStatus,
  confirmed: false,
  pageCount,
  createdAt: "2026-09-26T10:00:00.000Z",
  lastAccessedAt: "2026-09-26T10:00:00.000Z",
});

function renderHome() {
  const onOpenCourse = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <HomeScreen firstName="Léa" onPhoto={vi.fn()} onLogout={vi.fn()} onOpenCourse={onOpenCourse} />
    </QueryClientProvider>,
  );
  return { onOpenCourse };
}

// docs/ui.md, "Accueil": a banner above the list brings the child back to
// the account's one unconfirmed course, with a sentence for its state.
describe("HomeScreen banner", () => {
  for (const [status, sentence] of [
    ["pending", "Je regarde encore ta photo…"],
    ["running", "Je regarde encore ta photo…"],
    ["ready", "Ta photo est prête !"],
    ["illegible", "Oups, on reprend la photo ?"],
    ["not_a_course_page", "Oups, on reprend la photo ?"],
    ["failed", "Oh, quelque chose a coincé."],
  ] as const) {
    it(`${status}: « ${sentence} », and a tap opens that course`, async () => {
      api.listCourses.mockResolvedValue([]);
      api.getUnconfirmedCourse.mockResolvedValue(pending(status));
      const { onOpenCourse } = renderHome();

      fireEvent.click(await screen.findByRole("button", { name: sentence }));

      expect(onOpenCourse).toHaveBeenCalledWith("c9");
    });
  }

  it("no banner without an unconfirmed course", async () => {
    api.listCourses.mockResolvedValue([]);
    api.getUnconfirmedCourse.mockResolvedValue(null);
    renderHome();

    await screen.findByRole("button", { name: "Photographier un cours" });
    for (const sentence of ["Je regarde encore ta photo…", "Ta photo est prête !", "Oups, on reprend la photo ?", "Oh, quelque chose a coincé."]) {
      expect(screen.queryByRole("button", { name: sentence })).not.toBeInTheDocument();
    }
  });
});
