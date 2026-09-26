// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CourseScreen } from "./CourseScreen.js";

const api = vi.hoisted(() => ({
  getCourse: vi.fn(),
  confirmCourse: vi.fn(),
  rejectCourse: vi.fn(),
  retryExtraction: vi.fn(),
  pageFileUrl: (id: string, index: number) => `/api/courses/${id}/pages/${String(index)}/file`,
  pollInterval: () => false as const,
}));
vi.mock("../lib/courses.js", () => api);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  for (const mock of [api.getCourse, api.confirmCourse, api.rejectCourse, api.retryExtraction]) mock.mockReset();
});

const courseIn = (extractionStatus: string, extra: object = {}) => ({
  id: "c1",
  title: extractionStatus === "ready" ? "Le verbe" : "",
  subject: extractionStatus === "ready" ? "french" : null,
  grade: "CM1",
  color: extractionStatus === "ready" ? "matiere-francais" : "",
  extractionStatus,
  confirmed: false,
  pageCount: 1,
  createdAt: "2026-09-26T10:00:00.000Z",
  lastAccessedAt: "2026-09-26T10:00:00.000Z",
  ...extra,
});

function renderCourse() {
  const onHome = vi.fn();
  const onPhoto = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <CourseScreen courseId="c1" onHome={onHome} onPhoto={onPhoto} />
    </QueryClientProvider>,
  );
  return { onHome, onPhoto };
}

const pose = () => screen.getByTestId("mascot").getAttribute("data-pose");

describe("CourseScreen", () => {
  it("while the photo is read: the waiting mascot, the catalogue's sentence, and a way home", async () => {
    api.getCourse.mockResolvedValue(courseIn("running"));
    const { onHome } = renderCourse();

    expect(await screen.findByText(/Je regarde ta photo…|Je lis ta leçon…/)).toBeInTheDocument();
    expect(pose()).toBe("waiting");
    fireEvent.click(screen.getByRole("button", { name: "Retour à l'accueil" }));
    expect(onHome).toHaveBeenCalled();
  });

  it("loading the course: the waiting mascot and a sentence, never a bare spinner", () => {
    api.getCourse.mockReturnValue(new Promise(() => undefined));
    renderCourse();

    expect(pose()).toBe("waiting");
    expect(screen.getByText(/Je regarde ta photo…|Je lis ta leçon…/)).toBeInTheDocument();
  });

  it("error: the glitch mascot, a child's sentence, and « Réessaie » reads again", async () => {
    api.getCourse.mockRejectedValueOnce(new Error("GET failed with status 500")).mockResolvedValueOnce(courseIn("ready"));
    renderCourse();

    expect(await screen.findByText(/quelque chose a coincé/)).toBeInTheDocument();
    expect(pose()).toBe("glitch");
    fireEvent.click(screen.getByRole("button", { name: "Réessaie" }));
    expect(await screen.findByRole("heading", { name: "Le verbe" })).toBeInTheDocument();
  });

  it("a course replaced meanwhile (404): home, silently", async () => {
    api.getCourse.mockResolvedValue(null);
    const { onHome } = renderCourse();

    await waitFor(() => expect(onHome).toHaveBeenCalled());
    expect(screen.queryByText(/coincé|oups/i)).not.toBeInTheDocument();
  });

  for (const [status, sentence] of [
    ["illegible", /un peu floue|bien lire/],
    ["not_a_course_page", /pas de leçon|pas une page de cours/],
  ] as const) {
    it(`${status}: the sorry mascot, its own sentence, and only « Je reprends la photo »`, async () => {
      api.getCourse.mockResolvedValue(courseIn(status));
      renderCourse();

      expect(await screen.findByText(sentence)).toBeInTheDocument();
      expect(pose()).toBe("sorry");
      expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Je reprends la photo"]);
    });
  }

  it("« Je reprends la photo » drops the course, then opens the camera for a new one", async () => {
    api.getCourse.mockResolvedValue(courseIn("illegible"));
    api.rejectCourse.mockResolvedValue(undefined);
    const click = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => undefined);
    const { onPhoto } = renderCourse();

    fireEvent.click(await screen.findByRole("button", { name: "Je reprends la photo" }));

    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(api.rejectCourse).toHaveBeenCalledWith("c1");
    const file = new File(["camera"], "IMG_0003.jpg");
    fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [file] } });
    expect(onPhoto).toHaveBeenCalledWith(file);
  });

  it("failed: the glitch mascot, and « On réessaie » relaunches the reading", async () => {
    api.getCourse.mockResolvedValueOnce(courseIn("failed")).mockResolvedValue(courseIn("pending"));
    api.retryExtraction.mockResolvedValue(undefined);
    renderCourse();

    expect(await screen.findByText(/quelque chose a coincé|Ça n'a pas marché/)).toBeInTheDocument();
    expect(pose()).toBe("glitch");
    expect(screen.getByRole("button", { name: "Je reprends la photo" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "On réessaie" }));

    await waitFor(() => expect(api.retryExtraction).toHaveBeenCalledWith("c1"));
    expect(await screen.findByText(/Je regarde ta photo…|Je lis ta leçon…/)).toBeInTheDocument();
  });

  it("ready: the photo, the proposed title and subject, the account's grade, and the two buttons", async () => {
    api.getCourse.mockResolvedValue(courseIn("ready"));
    renderCourse();

    expect(await screen.findByRole("heading", { name: "Le verbe" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Ta photo" })).toHaveAttribute("src", "/api/courses/c1/pages/0/file");
    expect(screen.getByText("Français")).toBeInTheDocument();
    expect(screen.getByText("CM1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Oui, c'est ça !" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Je reprends la photo" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("« Oui, c'est ça ! » confirms the course and goes home", async () => {
    api.getCourse.mockResolvedValue(courseIn("ready"));
    api.confirmCourse.mockResolvedValue(undefined);
    const { onHome } = renderCourse();

    fireEvent.click(await screen.findByRole("button", { name: "Oui, c'est ça !" }));

    await waitFor(() => expect(onHome).toHaveBeenCalled());
    expect(api.confirmCourse).toHaveBeenCalledWith("c1");
  });

  it("nothing is shown as settled before the reading is over: no title while running", async () => {
    api.getCourse.mockResolvedValue(courseIn("running", { title: "Brouillon" }));
    renderCourse();

    await screen.findByText(/Je regarde ta photo…|Je lis ta leçon…/);
    expect(screen.queryByText("Brouillon")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Oui, c'est ça !" })).not.toBeInTheDocument();
  });
});
