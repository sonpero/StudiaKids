// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CaptureError } from "../lib/use-capture.js";
import { CaptureScreen } from "./CaptureScreen.js";

afterEach(cleanup);

const pagesOf = (count: number) => Array.from({ length: count }, (_, index) => ({ index, url: `blob:page-${String(index)}` }));

function renderCapture(count: number, error: CaptureError | null = null, busy = false) {
  const onPhoto = vi.fn();
  const onDone = vi.fn();
  render(<CaptureScreen pages={pagesOf(count)} error={error} busy={busy} onPhoto={onPhoto} onDone={onDone} />);
  return { onPhoto, onDone };
}

// docs/ui.md, "Photographier un cours (M2)", "Capture".
describe("CaptureScreen", () => {
  it("shows a thumbnail per page taken, with « Une autre page » and « C'est tout ! »", () => {
    renderCapture(2);

    expect(screen.getByRole("img", { name: "Page 1" })).toHaveAttribute("src", "blob:page-0");
    expect(screen.getByRole("img", { name: "Page 2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Une autre page" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "C'est tout !" })).toBeEnabled();
  });

  it("« Une autre page » disappears at the fifth page, « C'est tout ! » stays", () => {
    renderCapture(5);

    expect(screen.queryByRole("button", { name: "Une autre page" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "C'est tout !" })).toBeEnabled();
  });

  it("« C'est tout ! » waits for a page, and for the photo being sent", () => {
    renderCapture(0);
    expect(screen.getByRole("button", { name: "C'est tout !" })).toBeDisabled();
    cleanup();

    renderCapture(1, null, true);
    expect(screen.getByRole("button", { name: "C'est tout !" })).toBeDisabled();
    expect(screen.getByText("J'envoie ta photo…")).toBeInTheDocument();
  });

  it("the next photo comes from the camera and is handed over; « C'est tout ! » finishes", () => {
    const { onPhoto, onDone } = renderCapture(1);
    const input = document.querySelector('input[type="file"]')!;
    expect(input).toHaveAttribute("accept", "image/*");
    const file = new File(["camera"], "IMG_0002.jpg");

    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "C'est tout !" }));

    expect(onPhoto).toHaveBeenCalledWith(file);
    expect(onDone).toHaveBeenCalled();
  });

  const refusals: [CaptureError, "sorry" | "glitch", RegExp][] = [
    ["too_large", "sorry", /trop lourde/],
    ["unsupported", "sorry", /n'arrive pas à ouvrir/],
    ["unreadable", "sorry", /n'arrive pas à ouvrir/],
    ["duplicate", "sorry", /déjà pris cette page/],
    ["upload_failed", "glitch", /n'est pas partie/],
  ];
  for (const [error, pose, sentence] of refusals) {
    it(`${error}: the ${pose} mascot says it in a child's words, never the code`, () => {
      renderCapture(1, error);

      expect(screen.getByTestId("mascot")).toHaveAttribute("data-pose", pose);
      expect(screen.getByText(sentence)).toBeInTheDocument();
      expect(screen.queryByText(new RegExp(error))).not.toBeInTheDocument();
    });
  }

  it("with no page yet (the first photo was refused), the child can take one again", () => {
    renderCapture(0, "too_large");

    expect(screen.getByRole("button", { name: "Photographier un cours" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Une autre page" })).not.toBeInTheDocument();
  });
});
