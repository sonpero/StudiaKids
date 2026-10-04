// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HomeScreen } from "./HomeScreen.js";

const { listCoursesMock } = vi.hoisted(() => ({ listCoursesMock: vi.fn() }));
vi.mock("../lib/courses.js", () => ({ listCourses: listCoursesMock, getUnconfirmedCourse: () => Promise.resolve(null), pollInterval: () => false }));

afterEach(() => {
  cleanup();
  listCoursesMock.mockReset();
});

// After deleting a course (2026-10-04): back home, the mascot says it in
// its bubble, in place of its usual line.
describe("HomeScreen, after a course was deleted", () => {
  it("the mascot says the course is deleted and the stars stay", async () => {
    listCoursesMock.mockResolvedValue([]);
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <HomeScreen firstName="Léa" onPhoto={vi.fn()} onLogout={vi.fn()} notice={{ type: "course-deleted" }} />
      </QueryClientProvider>,
    );

    expect(await screen.findByText("C'est fait, le cours est supprimé. Tes étoiles sont toujours là !")).toBeInTheDocument();
    expect(screen.getByTestId("mascot")).toHaveAttribute("data-pose", "idle");
  });
});
