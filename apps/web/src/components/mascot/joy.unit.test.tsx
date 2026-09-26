// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Mascot } from "./Mascot.js";

afterEach(cleanup);

// M3: « Tes jeux sont prêts ! » is the first screen to need joy.
describe("Mascot, joy", () => {
  it("renders joy as itself, with the accessibility contract", () => {
    render(<Mascot pose="joy" />);
    const svg = screen.getByTestId("mascot");

    expect(svg).toHaveAttribute("data-pose", "joy");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("focusable", "false");
  });
});
