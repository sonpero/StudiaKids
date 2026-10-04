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

const verbe = { markdown: "# Le verbe\n\nLe verbe indique ce que fait le sujet.\n\n- chanter\n- finir", speech: "Le verbe\nLe verbe indique ce que fait le sujet.\nchanter\nfinir" };

function renderReader(highlights?: string[]) {
  const onHome = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ReaderScreen courseId="c1" onHome={onHome} highlights={highlights} />
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

  // No photo since 2026-10-04 (docs/securite.md): the text alone.
  it("ready: the lesson rendered from its Markdown, never its raw symbols, and no photo", async () => {
    api.getCourseText.mockResolvedValue(verbe);
    renderReader();

    expect(await screen.findByRole("heading", { name: "Le verbe", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Le verbe indique ce que fait le sujet.")).toBeInTheDocument();
    expect(within(screen.getByRole("article")).getAllByRole("listitem").map((item) => item.textContent)).toEqual(["chanter", "finir"]);
    expect(screen.queryByText(/^#/)).not.toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /photo/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Agrandir/ })).not.toBeInTheDocument();
    expect(document.querySelector('img[src*="/pages/"]')).toBeNull();
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

// M6, after the build (docs/design/tuteur.png): a tutor citation opens the
// reader on its passage, highlighted, rendered — never raw Markdown.
describe("ReaderScreen, a passage the tutor cited", () => {
  it("is highlighted in the lesson, with no Markdown syntax showing", async () => {
    api.getCourseText.mockResolvedValue({ ...verbe, markdown: "# Le verbe\n\n**Le verbe** indique ce que fait le sujet.\n\n- chanter\n- finir" });
    renderReader(["**Le verbe** indique ce que fait le sujet.\n\n- chanter\n- finir"]);

    const passage = await screen.findByTestId("cited-passage");
    expect(passage).toHaveTextContent("Le verbe indique ce que fait le sujet.");
    expect(within(passage).getByText("chanter")).toBeInTheDocument();
    expect(passage.textContent).not.toMatch(/[*#]/);
    expect(screen.getByRole("heading", { name: "Le verbe", level: 1 })).not.toBeNull();
    expect(passage).not.toContainElement(screen.getByRole("heading", { name: "Le verbe", level: 1 }));
  });

  it("without a passage, nothing is highlighted", async () => {
    api.getCourseText.mockResolvedValue(verbe);
    renderReader();
    await screen.findByText("Le verbe indique ce que fait le sujet.");
    expect(screen.queryByTestId("cited-passage")).not.toBeInTheDocument();
  });
});
