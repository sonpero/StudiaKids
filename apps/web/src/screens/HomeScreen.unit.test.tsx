// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HomeScreen } from "./HomeScreen.js";

const { listCoursesMock } = vi.hoisted(() => ({ listCoursesMock: vi.fn() }));
vi.mock("../lib/courses.js", () => ({ listCourses: listCoursesMock }));

afterEach(() => {
  cleanup();
  listCoursesMock.mockReset();
});

const verbe = {
  id: "c1",
  title: "Le verbe",
  subject: "french",
  grade: "CM1",
  color: "matiere-francais",
  extractionStatus: "ready",
  confirmed: true,
  pageCount: 3,
  createdAt: "2026-09-26T10:00:00.000Z",
  lastAccessedAt: "2026-09-26T10:00:00.000Z",
};

function renderHome(onPhoto = vi.fn(), onLogout = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <HomeScreen firstName="Léa" onPhoto={onPhoto} onLogout={onLogout} />
    </QueryClientProvider>,
  );
  return { onPhoto, onLogout };
}

// docs/ui.md, "États requis" and "Photographier un cours (M2)".
describe("HomeScreen", () => {
  it("loading: the waiting mascot and a short sentence", () => {
    listCoursesMock.mockReturnValue(new Promise(() => undefined));
    renderHome();

    expect(screen.getByTestId("mascot")).toHaveAttribute("data-pose", "waiting");
    expect(screen.getByText("Je cherche tes cours…")).toBeInTheDocument();
  });

  it("error: the glitch mascot, a child's sentence, and « Réessaie » loads again", async () => {
    listCoursesMock.mockRejectedValueOnce(new Error("GET /api/courses failed with status 500")).mockResolvedValueOnce([verbe]);
    renderHome();

    expect(await screen.findByText(/quelque chose a coincé/)).toBeInTheDocument();
    expect(screen.getByTestId("mascot")).toHaveAttribute("data-pose", "glitch");
    expect(screen.queryByText(/500|status/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Réessaie" }));
    expect(await screen.findByRole("heading", { name: "Mes cours" })).toBeInTheDocument();
  });

  it("empty: the mascot invites to photograph a lesson, the action right there, from the camera", async () => {
    listCoursesMock.mockResolvedValue([]);
    renderHome();

    expect(await screen.findByText(/Aucun cours pour l'instant|Prends ta leçon en photo/)).toBeInTheDocument();
    expect(screen.getByTestId("mascot")).toHaveAttribute("data-pose", "idle");
    expect(screen.getByRole("button", { name: "Photographier un cours" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Mes cours" })).not.toBeInTheDocument();
    const input = document.querySelector('input[type="file"]');
    expect(input).toHaveAttribute("accept", "image/*");
    expect(input).toHaveAttribute("capture");
  });

  it("ready: « Mes cours » lists each course with its title, subject in French, grade and subject color token", async () => {
    listCoursesMock.mockResolvedValue([verbe]);
    renderHome();

    expect(await screen.findByRole("heading", { name: "Mes cours" })).toBeInTheDocument();
    const card = screen.getByRole("button", { name: /Le verbe/ });
    expect(card).toHaveTextContent("Français · CM1");
    expect(card.querySelector("[data-subject-chip]")).toHaveStyle({ backgroundColor: "var(--matiere-francais)" });
    expect(screen.getByText(/On reprend un cours \?|Choisis un cours/)).toBeInTheDocument();
  });

  it("greets the child by first name and keeps a discreet « Se déconnecter », whatever the list's state", async () => {
    listCoursesMock.mockRejectedValue(new Error("down"));
    const { onLogout } = renderHome();

    expect(screen.getByText("Salut Léa !")).toBeInTheDocument();
    await screen.findByText(/quelque chose a coincé/);
    fireEvent.click(screen.getByRole("button", { name: "Se déconnecter" }));
    expect(onLogout).toHaveBeenCalled();
  });

  it("hands the chosen photo over, as chosen", async () => {
    listCoursesMock.mockResolvedValue([]);
    const { onPhoto } = renderHome();
    await screen.findByRole("button", { name: "Photographier un cours" });
    const file = new File(["camera"], "IMG_0001.jpg", { type: "image/jpeg" });

    fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [file] } });

    expect(onPhoto).toHaveBeenCalledWith(file);
  });
});
