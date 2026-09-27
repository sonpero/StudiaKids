// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TutorScreen } from "./TutorScreen.js";

const api = vi.hoisted(() => ({ openTutor: vi.fn(), getConversation: vi.fn(), askTutor: vi.fn() }));
vi.mock("../lib/tutor.js", () => api);
const courses = vi.hoisted(() => ({ getCourse: vi.fn() }));
vi.mock("../lib/courses.js", () => courses);
vi.mock("../lib/progress.js", () => ({ getProgress: () => Promise.resolve({ total: 49, currentStreak: 0, bestStreak: 0 }), starsLabel: () => "49 étoiles" }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const conversation = { id: "k1", courseId: "c1", title: null, createdAt: "" };
const msg = (id: string, role: "user" | "assistant", content: string, extra: Record<string, unknown> = {}) => ({ id, role, content, citations: null, issue: null, outOfBand: false, partial: false, createdAt: "", ...extra });

function renderTutor(messages: unknown[]) {
  api.openTutor.mockResolvedValue({ conversation, showDisclosure: false });
  api.getConversation.mockResolvedValue({ conversation, messages });
  courses.getCourse.mockResolvedValue({ id: "c1", title: "Le verbe", subject: "french", grade: "CM1", color: "matiere-francais" });
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <TutorScreen courseId="c1" onHome={vi.fn()} onOpenPassage={vi.fn()} />
    </QueryClientProvider>,
  );
}
const has = (element: Element | null | undefined, ...tokens: string[]) => {
  for (const token of tokens) expect(element?.className.split(/\s+/), token).toContain(token);
};

// docs/design/tuteur.png.
describe("TutorScreen, as drawn in docs/design/tuteur.png", () => {
  it("an answer's Markdown is rendered, never shown: no ** nor ## in the thread", async () => {
    renderTutor([msg("m1", "user", "c koi un verbe ?"), msg("m2", "assistant", "## Le verbe\n\nLe mot **chante** est le verbe.\n\n- chanter\n- finir")]);
    const answer = await within(await screen.findByRole("log")).findByRole("article");
    expect(answer.textContent).not.toMatch(/\*\*|##/);
    expect(within(answer).getByText("chante").tagName).toBe("STRONG");
    expect(within(answer).getByText("chanter").tagName).toBe("LI");
  });

  it("the child's question in a turquoise bubble; the answer in a white bubble with a hard shadow, the mascot's face beside it", async () => {
    renderTutor([msg("m1", "user", "c koi un verbe ?"), msg("m2", "assistant", "Un verbe.")]);
    const log = await screen.findByRole("log");
    has(within(log).getByText("c koi un verbe ?").closest("[data-question]"), "bg-turquoise", "border-3", "rounded-carte");
    const answer = await within(log).findByRole("article");
    has(answer.querySelector("[data-answer]"), "bg-white", "shadow-moyenne");
    expect(within(answer).getByTestId("mascot").parentElement?.className ?? "").not.toContain("border-3");
  });

  it("a header with the star pill, and the course named in its subject's pastel pill", async () => {
    renderTutor([]);
    expect(await screen.findByRole("heading", { name: "Tuteur", level: 1 })).toBeInTheDocument();
    expect(await screen.findByTestId("star-counter")).toBeInTheDocument();
    const chip = await screen.findByText("Le verbe · Français CM1");
    expect(chip.closest("[data-course-chip]")).toHaveStyle({ backgroundColor: "var(--matiere-francais)" });
  });

  it("« Dans ton cours » takes the course's pastel too", async () => {
    renderTutor([msg("m1", "user", "q"), msg("m2", "assistant", "r", { citations: [{ text: "Le verbe" }] })]);
    await screen.findByText("Le verbe · Français CM1");
    expect(await screen.findByRole("button", { name: "Dans ton cours" })).toHaveStyle({ backgroundColor: "var(--matiere-francais)" });
  });
});
