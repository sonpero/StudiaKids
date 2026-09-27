// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CourseScreen } from "./CourseScreen.js";

const api = vi.hoisted(() => ({
  getCourse: vi.fn(),
  confirmCourse: vi.fn(),
  rejectCourse: vi.fn(),
  retryExtraction: vi.fn(),
  pageFileUrl: () => "/photo",
  pollInterval: () => false as const,
}));
vi.mock("../lib/courses.js", () => api);
afterEach(() => {
  cleanup();
  api.getCourse.mockReset();
});

const course = (extractionStatus: string) => ({ id: "c1", title: "Le verbe", subject: "french", grade: "CM1", color: "matiere-francais", extractionStatus, confirmed: false, pageCount: 1, createdAt: "", lastAccessedAt: "" });
function renderCourse(status: string) {
  api.getCourse.mockResolvedValue(course(status));
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <CourseScreen courseId="c1" onHome={vi.fn()} onPhoto={vi.fn()} />
    </QueryClientProvider>,
  );
}
const has = (element: Element | null | undefined, ...tokens: string[]) => {
  for (const token of tokens) expect(element?.className.split(/\s+/), token).toContain(token);
};

// No mockup: the mockups' language (docs/design/*.png, tokens.md).
describe("CourseScreen, in the mockups' language", () => {
  it("while reading and on an unusable photo, the mascot speaks in its bubble", async () => {
    renderCourse("running");
    expect((await screen.findByText(/Je regarde ta photo…|Je lis ta leçon…/)).hasAttribute("data-bubble")).toBe(true);
    cleanup();
    renderCourse("illegible");
    expect((await screen.findByText(/bien lire|un peu floue/)).hasAttribute("data-bubble")).toBe(true);
  });

  it("the confirmation: the photo in a card, the course's pills, the shared actions", async () => {
    renderCourse("ready");
    has((await screen.findByRole("img", { name: "Ta photo" })).parentElement, "rounded-carte", "border-3", "bg-white", "shadow-moyenne");
    has(screen.getByRole("button", { name: "Oui, c'est ça !" }), "bg-mandarine", "rounded-carte");
    has(screen.getByRole("button", { name: "Je reprends la photo" }), "bg-turquoise", "rounded-carte");
    has(screen.getByText("Français"), "rounded-pastille", "border-2");
  });
});
