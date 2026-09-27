// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MainScreens } from "./MainScreens.js";

const api = vi.hoisted(() => ({
  listCourses: vi.fn(),
  getUnconfirmedCourse: vi.fn(),
  getCourse: vi.fn(),
  pageFileUrl: (id: string, index: number) => `/api/courses/${id}/pages/${String(index)}/file`,
  pollInterval: () => false as const,
}));
vi.mock("../lib/courses.js", () => api);
const reader = vi.hoisted(() => ({ getCourseText: vi.fn() }));
vi.mock("../lib/reader.js", () => reader);
const tutor = vi.hoisted(() => ({ openTutor: vi.fn(), getConversation: vi.fn(), askTutor: vi.fn() }));
vi.mock("../lib/tutor.js", () => tutor);

const verbe = { id: "c1", title: "Le verbe", subject: "french", grade: "CM1", color: "matiere-francais", extractionStatus: "ready", extractionStarted: true, confirmed: true, pageCount: 1, createdAt: "", lastAccessedAt: "2026-09-27T10:00:00.000Z", exerciseCount: 0 };
const conversation = { id: "k1", courseId: "c1", title: null, createdAt: "" };

beforeEach(() => {
  api.listCourses.mockResolvedValue([verbe]);
  api.getUnconfirmedCourse.mockResolvedValue(null);
  reader.getCourseText.mockResolvedValue({ markdown: "# Le verbe\n\nLe verbe indique ce que fait le sujet.", speech: "", photos: [] });
  tutor.openTutor.mockResolvedValue({ conversation, showDisclosure: false });
  tutor.getConversation.mockResolvedValue({ conversation, messages: [] });
});

afterEach(() => cleanup());

function renderMain() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MainScreens firstName="Léa" onLogout={vi.fn()} reencode={(file) => Promise.resolve(new Blob([file]))} />
    </QueryClientProvider>,
  );
}
const field = () => screen.findByRole("textbox", { name: "Écris ta question…" });
const tabs = () => within(screen.getByRole("navigation", { name: "Onglets" }));

// docs/ui.md, "Tuteur (M6)": a Tuteur tab, and « Poser une question » on
// the reader and on the home screen's last course.
describe("MainScreens: the tutor", () => {
  it("« Poser une question » under the last course on the home screen opens its tutor, on the Tuteur tab", async () => {
    renderMain();

    fireEvent.click(await screen.findByRole("button", { name: "Poser une question" }));

    expect(await field()).toBeInTheDocument();
    expect(tutor.openTutor).toHaveBeenCalledWith("c1");
    expect(tabs().getByRole("button", { name: "Tuteur" })).toHaveAttribute("aria-current", "page");
  });

  it("the reader's « Poser une question » opens the tutor; the tabs go back and forth", async () => {
    renderMain();
    fireEvent.click(await screen.findByRole("button", { name: /Le verbe/ }));
    expect(await screen.findByText("Le verbe indique ce que fait le sujet.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Poser une question" }));
    expect(await field()).toBeInTheDocument();

    fireEvent.click(tabs().getByRole("button", { name: "Lire" }));
    expect(await screen.findByText("Le verbe indique ce que fait le sujet.")).toBeInTheDocument();
    fireEvent.click(tabs().getByRole("button", { name: "Tuteur" }));
    expect(await field()).toBeInTheDocument();
  });
});
