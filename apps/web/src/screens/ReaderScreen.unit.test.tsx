// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReaderScreen } from "./ReaderScreen.js";

const api = vi.hoisted(() => ({ getCourseText: vi.fn() }));
vi.mock("../lib/reader.js", () => api);

class Utterance {
  lang = "";
  onend: (() => void) | null = null;
  constructor(public text: string) {}
}

afterEach(() => {
  cleanup();
  api.getCourseText.mockReset();
  vi.unstubAllGlobals();
});

const verbe = { markdown: "# Le verbe\n\nLe verbe indique ce que fait le sujet.\n\n- chanter\n- finir", speech: "Le verbe\nLe verbe indique ce que fait le sujet.\nchanter\nfinir", photos: [{ index: 0 }, { index: 1 }] };

function renderReader() {
  const onHome = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ReaderScreen courseId="c1" onHome={onHome} />
    </QueryClientProvider>,
  );
  return { onHome };
}

function stubSynthesis() {
  const synthesis = { speak: vi.fn(), cancel: vi.fn() };
  vi.stubGlobal("speechSynthesis", synthesis);
  vi.stubGlobal("SpeechSynthesisUtterance", Utterance);
  return synthesis;
}

// docs/modules/reader.md, "Écran", and docs/ui.md, "États requis".
describe("ReaderScreen", () => {
  it("loading: the waiting mascot and a short sentence", () => {
    api.getCourseText.mockReturnValue(new Promise(() => undefined));
    renderReader();

    expect(screen.getByTestId("mascot")).toHaveAttribute("data-pose", "waiting");
    expect(screen.getByText("J'ouvre ton cours…")).toBeInTheDocument();
  });

  it("error: the glitch mascot, a child's sentence, and « Réessaie » reads again", async () => {
    api.getCourseText.mockRejectedValueOnce(new Error("GET failed with status 500")).mockResolvedValueOnce(verbe);
    renderReader();

    expect(await screen.findByText("Oh, quelque chose a coincé. On réessaie ?")).toBeInTheDocument();
    expect(screen.getByTestId("mascot")).toHaveAttribute("data-pose", "glitch");
    fireEvent.click(screen.getByRole("button", { name: "Réessaie" }));
    expect(await screen.findByRole("heading", { name: "Le verbe", level: 1 })).toBeInTheDocument();
  });

  it("a course deleted meanwhile goes home", async () => {
    api.getCourseText.mockResolvedValue(null);
    const { onHome } = renderReader();

    await waitFor(() => expect(onHome).toHaveBeenCalled());
  });

  it("ready: the lesson rendered from its Markdown, never its raw symbols, and the course's photos", async () => {
    api.getCourseText.mockResolvedValue(verbe);
    renderReader();

    expect(await screen.findByRole("heading", { name: "Le verbe", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Le verbe indique ce que fait le sujet.")).toBeInTheDocument();
    expect(within(screen.getByRole("article")).getAllByRole("listitem").map((item) => item.textContent)).toEqual(["chanter", "finir"]);
    expect(screen.queryByText(/^#/)).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Photo 1 du cours" })).toHaveAttribute("src", "/api/courses/c1/pages/0/file");
    expect(screen.getByRole("img", { name: "Photo 2 du cours" })).toHaveAttribute("src", "/api/courses/c1/pages/1/file");
  });

  it("a tap enlarges a photo, and « Fermer » puts it back", async () => {
    api.getCourseText.mockResolvedValue(verbe);
    renderReader();

    fireEvent.click(await screen.findByRole("button", { name: "Agrandir la photo 2" }));
    expect(screen.getByRole("img", { name: "Photo 2 du cours, en grand" })).toHaveAttribute("src", "/api/courses/c1/pages/1/file");
    fireEvent.click(screen.getByRole("button", { name: "Fermer" }));
    expect(screen.queryByRole("img", { name: /en grand/ })).not.toBeInTheDocument();
  });

  it("the voice never starts by itself: « Écouter » reads the text to speak, « Stop » stops it", async () => {
    const synthesis = stubSynthesis();
    api.getCourseText.mockResolvedValue(verbe);
    renderReader();
    await screen.findByRole("heading", { name: "Le verbe", level: 1 });
    expect(synthesis.speak).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Écouter" }));
    expect((synthesis.speak.mock.calls[0]?.[0] as Utterance).text).toBe(verbe.speech);
    synthesis.cancel.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Stop" }));

    expect(synthesis.cancel).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Écouter" })).toBeInTheDocument();
  });

  it("without speech synthesis in the browser, there is no « Écouter » button", async () => {
    vi.stubGlobal("speechSynthesis", undefined);
    api.getCourseText.mockResolvedValue(verbe);
    renderReader();

    await screen.findByRole("heading", { name: "Le verbe", level: 1 });
    expect(screen.queryByRole("button", { name: "Écouter" })).not.toBeInTheDocument();
  });

  it("« Accueil » goes back home", async () => {
    api.getCourseText.mockResolvedValue(verbe);
    const { onHome } = renderReader();

    fireEvent.click(await screen.findByRole("button", { name: "Accueil" }));
    expect(onHome).toHaveBeenCalled();
  });
});
