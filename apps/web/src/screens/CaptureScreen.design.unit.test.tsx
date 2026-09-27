// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CaptureScreen } from "./CaptureScreen.js";

afterEach(cleanup);
const has = (element: Element | null | undefined, ...tokens: string[]) => {
  for (const token of tokens) expect(element?.className.split(/\s+/), token).toContain(token);
};
const page = { index: 0, url: "blob:page" };

// No mockup: the mockups' language (docs/design/*.png, tokens.md).
describe("CaptureScreen, in the mockups' language", () => {
  it("each page taken is a photo card; « C'est tout ! » the primary action", () => {
    render(<CaptureScreen pages={[page]} error={null} busy={false} onPhoto={vi.fn()} onDone={vi.fn()} />);
    has(screen.getByRole("img", { name: "Page 1" }).parentElement, "rounded-carte", "border-3", "bg-white", "shadow-moyenne");
    has(screen.getByRole("button", { name: "C'est tout !" }), "bg-mandarine", "rounded-carte");
  });

  it("a refused photo: the mascot says it in its bubble", () => {
    render(<CaptureScreen pages={[page]} error="duplicate" busy={false} onPhoto={vi.fn()} onDone={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveAttribute("data-bubble");
  });
});
