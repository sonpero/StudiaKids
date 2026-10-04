// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DeleteCourseScreen } from "./DeleteCourseScreen.js";

const api = vi.hoisted(() => ({ deleteCourse: vi.fn() }));
vi.mock("../lib/courses.js", () => api);

afterEach(() => {
  cleanup();
  api.deleteCourse.mockReset();
});

function renderScreen() {
  const onKeep = vi.fn();
  const onDeleted = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
      <DeleteCourseScreen courseId="c1" title="Le verbe" onKeep={onKeep} onDeleted={onDeleted} />
    </QueryClientProvider>,
  );
  return { onKeep, onDeleted };
}

// Deleting a confirmed course (decided on 2026-10-04, docs/ui.md): never in
// one tap — the mascot asks, keeping the course is the one put forward.
describe("DeleteCourseScreen", () => {
  it("the calm mascot says what goes and what stays; « Je garde mon cours » comes first, in the main colour", () => {
    renderScreen();

    expect(screen.getByTestId("mascot")).toHaveAttribute("data-pose", "idle");
    expect(screen.getByText("Le cours « Le verbe » et ses jeux vont disparaître. Tes étoiles, elles, restent !")).toBeInTheDocument();
    const [first, second] = screen.getAllByRole("button");
    expect(first).toHaveAccessibleName("Je garde mon cours");
    expect(first).toHaveClass("bg-mandarine");
    expect(second).toHaveAccessibleName("Supprimer le cours");
    expect(second).not.toHaveClass("bg-mandarine");
    expect(api.deleteCourse).not.toHaveBeenCalled();
  });

  it("« Je garde mon cours » deletes nothing and goes back", () => {
    const { onKeep, onDeleted } = renderScreen();

    fireEvent.click(screen.getByRole("button", { name: "Je garde mon cours" }));

    expect(onKeep).toHaveBeenCalled();
    expect(onDeleted).not.toHaveBeenCalled();
    expect(api.deleteCourse).not.toHaveBeenCalled();
  });

  it("« Supprimer le cours » deletes it, then goes home", async () => {
    api.deleteCourse.mockResolvedValue(undefined);
    const { onDeleted } = renderScreen();

    fireEvent.click(screen.getByRole("button", { name: "Supprimer le cours" }));

    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(api.deleteCourse).toHaveBeenCalledWith("c1");
  });

  it("a failure: the glitch mascot and a retry, never a raw error; the course is still there", async () => {
    api.deleteCourse.mockRejectedValueOnce(new Error("DELETE /api/courses/:id failed with status 500")).mockResolvedValueOnce(undefined);
    const { onDeleted } = renderScreen();

    fireEvent.click(screen.getByRole("button", { name: "Supprimer le cours" }));

    expect(await screen.findByText("Oh, quelque chose a coincé. On réessaie ?")).toBeInTheDocument();
    expect(screen.getByTestId("mascot")).toHaveAttribute("data-pose", "glitch");
    expect(screen.queryByText(/500|status/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Réessaie" }));
    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
  });
});
