// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReaderScreen } from "./ReaderScreen.js";

const api = vi.hoisted(() => ({ getCourseText: vi.fn() }));
vi.mock("../lib/reader.js", () => api);

afterEach(() => {
  cleanup();
  api.getCourseText.mockReset();
});

// The course's screen offers to delete it (2026-10-04): a quiet button,
// which only opens the question, never deletes by itself.
describe("ReaderScreen, deleting the course", () => {
  it("« Supprimer ce cours » asks, it deletes nothing itself", async () => {
    api.getCourseText.mockResolvedValue({ markdown: "# Le verbe", speech: "Le verbe" });
    const onDelete = vi.fn();
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ReaderScreen courseId="c1" onHome={vi.fn()} onDelete={onDelete} />
      </QueryClientProvider>,
    );

    const button = await screen.findByRole("button", { name: "Supprimer ce cours" });
    expect(button).toHaveClass("min-h-11");
    fireEvent.click(button);

    expect(onDelete).toHaveBeenCalled();
  });
});
