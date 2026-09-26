// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GenerationPanel } from "./GenerationPanel.js";

const api = vi.hoisted(() => ({ getGenerationStatus: vi.fn(), startGeneration: vi.fn(), generationPollInterval: () => false as const }));
vi.mock("../lib/generation.js", () => api);

afterEach(() => {
  cleanup();
  api.getGenerationStatus.mockReset();
  api.startGeneration.mockReset();
});

const status = (value: string, done = 0, total = 0) => ({ status: value, done, total, failed: 0, itemCount: value === "insufficient_coverage" ? 0 : 12 });

function renderPanel() {
  const onPhoto = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <GenerationPanel courseId="c1" onPhoto={onPhoto} />
    </QueryClientProvider>,
  );
  return { onPhoto };
}

const pose = () => screen.getByTestId("mascot").getAttribute("data-pose");

// docs/ui.md, "Lire un cours et créer ses jeux (M3)".
describe("GenerationPanel", () => {
  it("never starts by itself: « Créer mes jeux » starts it, then the mascot prepares the games", async () => {
    api.getGenerationStatus.mockResolvedValue(status("not_started"));
    api.startGeneration.mockResolvedValue(status("splitting"));
    renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: "Créer mes jeux" }));

    await waitFor(() => expect(api.startGeneration).toHaveBeenCalledWith("c1"));
    expect(await screen.findByText(/Je prépare tes jeux…|Tes jeux arrivent…/)).toBeInTheDocument();
    expect(pose()).toBe("waiting");
    expect(screen.queryByRole("button", { name: "Créer mes jeux" })).not.toBeInTheDocument();
  });

  it("in progress: honest progress in game types, never a percentage", async () => {
    api.getGenerationStatus.mockResolvedValue(status("generating", 2, 5));
    renderPanel();

    expect(await screen.findByText("2 sur 5")).toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it("ready: joy and « Tes jeux sont prêts ! »", async () => {
    api.getGenerationStatus.mockResolvedValue(status("ready", 5, 5));
    renderPanel();

    expect(await screen.findByText("Tes jeux sont prêts !")).toBeInTheDocument();
    expect(pose()).toBe("joy");
  });

  it("a lesson too short: sorry, the sentence, and a new photo from here", async () => {
    api.getGenerationStatus.mockResolvedValue(status("insufficient_coverage"));
    const { onPhoto } = renderPanel();

    expect(await screen.findByText("Il n'y a pas assez à apprendre sur cette photo. On en prend une autre ?")).toBeInTheDocument();
    expect(pose()).toBe("sorry");
    const file = new File(["a"], "a.jpg");
    fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [file] } });
    expect(onPhoto).toHaveBeenCalledWith(file);
  });

  it("a technical failure: glitch, and « On réessaie » starts the games again", async () => {
    api.getGenerationStatus.mockResolvedValue(status("failed"));
    api.startGeneration.mockResolvedValue(status("splitting"));
    renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: "On réessaie" }));

    expect(pose()).toBe("glitch");
    await waitFor(() => expect(api.startGeneration).toHaveBeenCalledWith("c1"));
    expect(await screen.findByText(/Je prépare tes jeux…|Tes jeux arrivent…/)).toBeInTheDocument();
  });

  it("the status cannot be read: glitch, a child's sentence and a way to try again", async () => {
    api.getGenerationStatus.mockRejectedValueOnce(new Error("status 500")).mockResolvedValueOnce(status("not_started"));
    renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: "Réessaie" }));

    expect(await screen.findByRole("button", { name: "Créer mes jeux" })).toBeInTheDocument();
  });
});
