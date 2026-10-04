// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GenerationPanel } from "./GenerationPanel.js";
import { ReaderScreen } from "./ReaderScreen.js";

const reader = vi.hoisted(() => ({ getCourseText: vi.fn() }));
vi.mock("../lib/reader.js", () => reader);
const generation = vi.hoisted(() => ({ getGenerationStatus: vi.fn(), startGeneration: vi.fn(), generationPollInterval: () => false as const }));
vi.mock("../lib/generation.js", () => generation);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const has = (element: Element | null | undefined, ...tokens: string[]) => {
  for (const token of tokens) expect(element?.className.split(/\s+/), token).toContain(token);
};
const client = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

// No mockup: the mockups' language (docs/design/*.png, tokens.md).
describe("ReaderScreen, in the mockups' language", () => {
  it("the lesson on a white card; « Écouter » a turquoise pill with a speaker; « Poser une question » a pill", async () => {
    vi.stubGlobal("speechSynthesis", { speak: vi.fn(), cancel: vi.fn() });
    vi.stubGlobal("SpeechSynthesisUtterance", class {});
    reader.getCourseText.mockResolvedValue({ markdown: "# Le verbe\n\nLe verbe indique ce que fait le sujet.", speech: "" });
    render(
      <QueryClientProvider client={client()}>
        <ReaderScreen courseId="c1" onHome={vi.fn()} onAsk={vi.fn()} />
      </QueryClientProvider>,
    );
    has((await screen.findByText("Le verbe indique ce que fait le sujet.")).closest("article"), "rounded-grande-carte", "border-3", "bg-white", "shadow-moyenne");
    const listen = screen.getByRole("button", { name: "Écouter" });
    has(listen, "rounded-pastille", "bg-turquoise");
    expect(listen.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    has(screen.getByRole("button", { name: "Poser une question" }), "rounded-pastille", "border-3");
  });

  it("its error state: the mascot speaks in its bubble", async () => {
    reader.getCourseText.mockRejectedValue(new Error("500"));
    render(
      <QueryClientProvider client={client()}>
        <ReaderScreen courseId="c1" onHome={vi.fn()} />
      </QueryClientProvider>,
    );
    expect((await screen.findByText("Oh, quelque chose a coincé. On réessaie ?")).hasAttribute("data-bubble")).toBe(true);
  });

  it("the games being made: the mascot speaks in its bubble", async () => {
    generation.getGenerationStatus.mockResolvedValue({ status: "generating", done: 1, total: 3, failed: 0, itemCount: 8 });
    render(
      <QueryClientProvider client={client()}>
        <GenerationPanel courseId="c1" onPhoto={vi.fn()} />
      </QueryClientProvider>,
    );
    expect((await screen.findByText(/Je prépare tes jeux|Tes jeux arrivent/)).hasAttribute("data-bubble")).toBe(true);
  });
});
