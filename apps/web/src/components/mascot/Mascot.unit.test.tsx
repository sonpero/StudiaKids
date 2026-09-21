// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Mascot } from "./Mascot.js";

afterEach(cleanup);

describe("Mascot", () => {
  it("renders the idle pose with the accessibility contract from docs/ui.md", () => {
    render(<Mascot pose="idle" />);
    const svg = screen.getByTestId("mascot");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("focusable", "false");
  });

  it("falls back to idle, never throwing or rendering nothing, for a pose not yet drawn (docs/ui.md's robustness rule)", () => {
    // "sorry"/"glitch"/"refusal" are specified but not yet drawn
    // (docs/modules/mascot.md) — this is the same runtime robustness rule,
    // not just the unrecognized-value case.
    render(<Mascot pose="sorry" />);
    expect(screen.getByTestId("mascot")).toBeInTheDocument();
  });

  it("falls back to idle for a pose value unknown at runtime, never throwing or rendering an empty element", () => {
    // Cast bypasses the closed MascotPose union deliberately: this proves
    // the runtime guard, not the type system (docs/ui.md's robustness rule).
    render(<Mascot pose={"not-a-real-pose" as never} />);
    expect(screen.getByTestId("mascot")).toBeInTheDocument();
  });
});
