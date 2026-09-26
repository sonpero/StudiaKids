// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MainScreens } from "./MainScreens.js";

const api = vi.hoisted(() => ({ listCourses: vi.fn(), createCourse: vi.fn(), uploadPage: vi.fn(), startExtraction: vi.fn() }));
vi.mock("../lib/courses.js", () => api);

beforeEach(() => {
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => "blob:thumb"), revokeObjectURL: vi.fn() }));
  api.listCourses.mockResolvedValue([]);
  api.createCourse.mockResolvedValue("c1");
  api.uploadPage.mockImplementation((_id: string, _blob: Blob) => Promise.resolve({ ok: true, index: 0 }));
  api.startExtraction.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  for (const mock of Object.values(api)) mock.mockReset();
});

function renderMain(reencode: (file: Blob) => Promise<Blob>) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MainScreens firstName="Léa" onLogout={vi.fn()} reencode={reencode} />
    </QueryClientProvider>,
  );
}

function choose(file: File) {
  fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [file] } });
}

const camera = (name: string) => new File([name], `${name}.jpg`, { type: "image/jpeg" });

describe("MainScreens: from home to capture", () => {
  it("a chosen photo is re-encoded, a course is created, and only the re-encoded photo is uploaded", async () => {
    const reencoded = new Blob(["canvas"], { type: "image/jpeg" });
    const reencode = vi.fn().mockResolvedValue(reencoded);
    renderMain(reencode);
    await screen.findByRole("button", { name: "Photographier un cours" });

    choose(camera("first"));

    expect(await screen.findByRole("img", { name: "Page 1" })).toBeInTheDocument();
    expect(reencode).toHaveBeenCalledWith(expect.objectContaining({ name: "first.jpg" }));
    expect(api.createCourse).toHaveBeenCalledTimes(1);
    expect(api.uploadPage).toHaveBeenCalledWith("c1", reencoded);
  });

  it("further pages go to the same course", async () => {
    renderMain((file) => Promise.resolve(new Blob([file])));
    await screen.findByRole("button", { name: "Photographier un cours" });
    choose(camera("first"));
    await screen.findByRole("img", { name: "Page 1" });
    api.uploadPage.mockResolvedValueOnce({ ok: true, index: 1 });

    choose(camera("second"));

    expect(await screen.findByRole("img", { name: "Page 2" })).toBeInTheDocument();
    expect(api.createCourse).toHaveBeenCalledTimes(1);
    expect(api.uploadPage).toHaveBeenLastCalledWith("c1", expect.any(Blob));
  });

  it("a refused page is explained and adds no thumbnail", async () => {
    renderMain((file) => Promise.resolve(new Blob([file])));
    await screen.findByRole("button", { name: "Photographier un cours" });
    choose(camera("first"));
    await screen.findByRole("img", { name: "Page 1" });
    api.uploadPage.mockResolvedValueOnce({ ok: false, error: "duplicate" });

    choose(camera("first-again"));

    expect(await screen.findByText(/déjà pris cette page/)).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Page 2" })).not.toBeInTheDocument();
  });

  it("a photo the browser cannot open is never uploaded", async () => {
    renderMain(() => Promise.reject(new Error("undecodable")));
    await screen.findByRole("button", { name: "Photographier un cours" });

    choose(camera("broken"));

    expect(await screen.findByText(/n'arrive pas à ouvrir/)).toBeInTheDocument();
    expect(api.uploadPage).not.toHaveBeenCalled();
  });

  it("a course replaced meanwhile (404) sends the child home silently", async () => {
    renderMain((file) => Promise.resolve(new Blob([file])));
    await screen.findByRole("button", { name: "Photographier un cours" });
    api.uploadPage.mockResolvedValueOnce({ ok: false, error: "not_found" });

    choose(camera("first"));

    await waitFor(() => expect(api.uploadPage).toHaveBeenCalled());
    expect(await screen.findByRole("button", { name: "Photographier un cours" })).toBeInTheDocument();
    expect(screen.getByTestId("mascot")).toHaveAttribute("data-pose", "idle");
  });

  it("« C'est tout ! » starts the reading of that course", async () => {
    renderMain((file) => Promise.resolve(new Blob([file])));
    await screen.findByRole("button", { name: "Photographier un cours" });
    choose(camera("first"));
    await screen.findByRole("img", { name: "Page 1" });

    fireEvent.click(screen.getByRole("button", { name: "C'est tout !" }));

    await waitFor(() => expect(api.startExtraction).toHaveBeenCalledWith("c1"));
  });
});
