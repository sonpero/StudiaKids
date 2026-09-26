// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Mascot } from "./Mascot.js";

afterEach(cleanup);

// M4: the flash dictation is the first screen to need watching.
describe("Mascot, watching", () => {
  it("renders watching as itself, with the accessibility contract", () => {
    render(<Mascot pose="watching" />);
    const svg = screen.getByTestId("mascot");

    expect(svg).toHaveAttribute("data-pose", "watching");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("focusable", "false");
  });
});
