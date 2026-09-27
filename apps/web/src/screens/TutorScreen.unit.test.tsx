// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TutorScreen } from "./TutorScreen.js";

const api = vi.hoisted(() => ({ openTutor: vi.fn(), getConversation: vi.fn(), askTutor: vi.fn() }));
vi.mock("../lib/tutor.js", () => api);

afterEach(() => {
  cleanup();
  api.openTutor.mockReset();
  api.getConversation.mockReset();
  api.askTutor.mockReset();
});

const conversation = { id: "k1", courseId: "c1", title: null, createdAt: "2026-09-27T10:00:00.000Z" };
let n = 0;
const msg = (role: "user" | "assistant", content: string, extra: Record<string, unknown> = {}) => ({
  id: `m${String(n++)}`,
  role,
  content,
  citations: null,
  issue: null,
  outOfBand: false,
  partial: false,
  createdAt: "2026-09-27T10:00:00.000Z",
  ...extra,
});
const DISTRESS = "Ce que tu écris est important.\nParles-en à un adulte en qui tu as confiance : quelqu'un de ta famille.\nTu peux aussi appeler, c'est gratuit :\nle 119, à toute heure ;\nle 3018, si on te harcèle.";

const onOpenPassage = vi.fn();
function renderTutor(opened: { showDisclosure: boolean } = { showDisclosure: false }, messages: unknown[] = []) {
  api.openTutor.mockResolvedValue({ conversation, ...opened });
  api.getConversation.mockResolvedValue({ conversation, messages });
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <TutorScreen courseId="c1" onHome={vi.fn()} onOpenPassage={onOpenPassage} />
    </QueryClientProvider>,
  );
}
const thread = () => screen.getByRole("log", { name: "Conversation avec le tuteur" });

// docs/ui.md, "Tuteur (M6)" and "États requis".
describe("TutorScreen, the four states", () => {
  it("loading: the waiting mascot and a sentence", () => {
    api.openTutor.mockReturnValue(new Promise(() => undefined));
    render(
      <QueryClientProvider client={new QueryClient()}>
        <TutorScreen courseId="c1" onHome={vi.fn()} />
      </QueryClientProvider>,
    );
    expect(screen.getByTestId("mascot")).toHaveAttribute("data-pose", "waiting");
    expect(screen.getByText("Je prépare ton tuteur…")).toBeInTheDocument();
  });

  it("error: the glitch mascot, a child's sentence, « Réessaie » tries again", async () => {
    api.openTutor.mockRejectedValueOnce(new Error("500")).mockResolvedValueOnce({ conversation, showDisclosure: false });
    api.getConversation.mockResolvedValue({ conversation, messages: [] });
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <TutorScreen courseId="c1" onHome={vi.fn()} />
      </QueryClientProvider>,
    );
    await screen.findByText("Oh, quelque chose a coincé. On réessaie ?");
    expect(screen.getByTestId("mascot")).toHaveAttribute("data-pose", "glitch");

    fireEvent.click(screen.getByRole("button", { name: "Réessaie" }));

    expect(await screen.findByRole("textbox", { name: "Écris ta question…" })).toBeInTheDocument();
  });

  it("empty: an invitation to ask about the lesson", async () => {
    renderTutor();
    expect(await screen.findByText("Pose-moi une question sur ton cours.")).toBeInTheDocument();
  });

  it("ready: the child's questions, the answers next to the mascot's avatar, their citations", async () => {
    renderTutor({ showDisclosure: false }, [msg("user", "c koi un verbe ?"), msg("assistant", "Un verbe, c'est une action.", { citations: [{ text: "Le verbe indique ce que fait le sujet." }] })]);

    const answer = await within(await screen.findByRole("log", { name: "Conversation avec le tuteur" })).findByRole("article");
    expect(within(thread()).getByText("c koi un verbe ?")).toBeInTheDocument();
    expect(within(answer).getByText("Un verbe, c'est une action.")).toBeInTheDocument();
    expect(within(answer).getByTestId("mascot")).toHaveAttribute("data-size", "avatar");
    // docs/design/tuteur.png (decided 2026-09-27, replacing the « … »
    // button): a compact « Dans ton cours » pill, never the cited text.
    expect(within(answer).queryByText(/Le verbe indique ce que fait le sujet/)).not.toBeInTheDocument();
    fireEvent.click(within(answer).getByRole("button", { name: "Dans ton cours" }));
    expect(onOpenPassage).toHaveBeenCalledWith(["Le verbe indique ce que fait le sujet."]);
  });

  it("an answer with no citation has no pill", async () => {
    renderTutor({ showDisclosure: false }, [msg("user", "q"), msg("assistant", "Une explication.", { citations: [] })]);
    const answer = await within(await screen.findByRole("log")).findByRole("article");
    expect(within(answer).queryByRole("button")).not.toBeInTheDocument();
  });

  it("no Markdown syntax ever shows in an answer", async () => {
    renderTutor({ showDisclosure: false }, [msg("user", "q"), msg("assistant", "Un verbe.", { citations: [{ text: "## Titre\n\n**gras** et\n- liste" }] })]);
    const answer = await within(await screen.findByRole("log")).findByRole("article");
    expect(answer.textContent).not.toMatch(/[*#]/);
  });
});

describe("TutorScreen, the disclosure", () => {
  it("the first time only: the mascot says an adult can read the exchanges", async () => {
    renderTutor({ showDisclosure: true });
    expect(await screen.findByText("Ce que tu écris ici, un grand de chez toi peut le relire, comme pour tes devoirs. Vas-y, pose ta question !")).toBeInTheDocument();
    cleanup();
    renderTutor({ showDisclosure: false });
    await screen.findByText("Pose-moi une question sur ton cours.");
    expect(screen.queryByText(/un grand de chez toi peut le relire/)).not.toBeInTheDocument();
  });
});

describe("TutorScreen, fixed outcomes", () => {
  it("a refusal, a failure or the cap: a mascot bubble with its fixed text, the refusal pose for a refusal", async () => {
    renderTutor({ showDisclosure: false }, [
      msg("user", "jeu vidéo"),
      msg("assistant", "Je ne peux pas répondre à ça, je ne connais que ton cours. Pose-moi une question sur ta leçon !", { issue: "off_topic" }),
      msg("user", "???"),
      msg("assistant", "Oups, je n'ai pas pu lire ta question. Tu peux la reposer ?", { issue: "unavailable" }),
    ]);
    const [refusal, failure] = await within(await screen.findByRole("log")).findAllByRole("article");
    expect(within(refusal!).getByTestId("mascot")).toHaveAttribute("data-pose", "refusal");
    expect(within(failure!).getByTestId("mascot")).toHaveAttribute("data-pose", "glitch");
  });

  it("distress: never a bubble of the thread — a help block outside it, with 119 and 3018 to call", async () => {
    renderTutor({ showDisclosure: false }, [msg("user", "on me tape"), msg("assistant", DISTRESS, { issue: "distress", outOfBand: true })]);

    const block = await screen.findByRole("region", { name: "Besoin d'aide" });
    expect(within(block).getByRole("link", { name: /119/ })).toHaveAttribute("href", "tel:119");
    expect(within(block).getByRole("link", { name: /3018/ })).toHaveAttribute("href", "tel:3018");
    expect(within(block).getByText("Ce que tu écris est important.")).toBeInTheDocument();
    expect(thread()).not.toContainElement(block);
    expect(within(thread()).queryByText(/Parles-en à un adulte/)).not.toBeInTheDocument();
    expect(within(thread()).queryAllByRole("article")).toHaveLength(0);
    expect(within(thread()).getByText("on me tape")).toBeInTheDocument();
  });
});

describe("TutorScreen, asking", () => {
  it("shows the question at once, the mascot searching, the answer as it comes, then the stored exchange", async () => {
    renderTutor();
    let finish: (value: unknown) => void = () => undefined;
    api.askTutor.mockImplementation((_id: string, _q: string, onChunk: (text: string) => void) => {
      onChunk("Un verbe, ");
      return new Promise((resolve) => {
        finish = resolve;
      });
    });
    const input = await screen.findByRole("textbox", { name: "Écris ta question…" });

    fireEvent.change(input, { target: { value: "c koi un verbe ?" } });
    fireEvent.click(screen.getByRole("button", { name: "Envoyer" }));

    expect(within(thread()).getByText("c koi un verbe ?")).toBeInTheDocument();
    expect(await within(thread()).findByText("Un verbe,", { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Envoyer" })).toBeDisabled();
    expect(api.askTutor).toHaveBeenCalledWith("k1", "c koi un verbe ?", expect.any(Function));

    api.getConversation.mockResolvedValue({ conversation, messages: [msg("user", "c koi un verbe ?"), msg("assistant", "Un verbe, c'est une action.")] });
    finish({ event: "done", message: msg("assistant", "Un verbe, c'est une action.") });

    expect(await within(thread()).findByText("Un verbe, c'est une action.")).toBeInTheDocument();
    expect(within(thread()).getAllByText("c koi un verbe ?")).toHaveLength(1);
    expect(input).toHaveValue("");
  });

  it("while waiting for the first words: the searching mascot", async () => {
    renderTutor();
    api.askTutor.mockReturnValue(new Promise(() => undefined));
    fireEvent.change(await screen.findByRole("textbox", { name: "Écris ta question…" }), { target: { value: "q" } });
    fireEvent.click(screen.getByRole("button", { name: "Envoyer" }));

    expect(await screen.findByText("Je cherche dans ton cours…")).toBeInTheDocument();
  });

  it("a request that fails: the mascot asks to send it again, never a silent end", async () => {
    renderTutor();
    api.askTutor.mockRejectedValue(new Error("offline"));
    fireEvent.change(await screen.findByRole("textbox", { name: "Écris ta question…" }), { target: { value: "q" } });
    fireEvent.click(screen.getByRole("button", { name: "Envoyer" }));

    expect(await within(thread()).findByText("Oups, je n'ai pas pu lire ta question. Tu peux la reposer ?")).toBeInTheDocument();
  });

  it("the field: a real label, 500 characters at most, nothing sent while empty", async () => {
    renderTutor();
    const input = await screen.findByRole("textbox", { name: "Écris ta question…" });
    expect(input).toHaveAttribute("maxLength", "500");
    expect(screen.getByRole("button", { name: "Envoyer" })).toBeDisabled();
    fireEvent.change(input, { target: { value: "   " } });
    expect(screen.getByRole("button", { name: "Envoyer" })).toBeDisabled();
    await waitFor(() => expect(api.askTutor).not.toHaveBeenCalled());
  });

  // docs/design/tuteur.png: a square mandarine send button with an icon,
  // the field's text as its placeholder, its label kept for screen readers.
  it("the send button is a square mandarine icon button; the field keeps its label", async () => {
    renderTutor();
    const input = await screen.findByRole("textbox", { name: "Écris ta question…" });
    expect(input).toHaveAttribute("placeholder", "Écris ta question…");
    const send = screen.getByRole("button", { name: "Envoyer" });
    expect(send.className).toContain("bg-[var(--color-mandarine)]");
    expect(send.className).toContain("h-[56px]");
    expect(send.className).toContain("w-[56px]");
    expect(send.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(send.textContent).toBe("");
  });
});
