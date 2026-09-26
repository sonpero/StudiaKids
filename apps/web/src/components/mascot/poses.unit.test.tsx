// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Mascot, type MascotPose } from "./Mascot.js";

afterEach(cleanup);

// The poses M2's screens use (docs/modules/mascot.md), each drawn — sorry
// and glitch from their provisional drafts in docs/design/ — and exposing
// which pose it is, so a scenario can tell a sorry screen from a glitch one.
describe("Mascot poses", () => {
  for (const pose of ["idle", "waiting", "sorry", "glitch"] as MascotPose[]) {
    it(`renders ${pose} as itself, with the accessibility contract`, () => {
      render(<Mascot pose={pose} />);
      const svg = screen.getByTestId("mascot");
      expect(svg).toHaveAttribute("data-pose", pose);
      expect(svg).toHaveAttribute("aria-hidden", "true");
      expect(svg).toHaveAttribute("focusable", "false");
    });
  }

  it("sorry and glitch are two different drawings", () => {
    const { container: sorry } = render(<Mascot pose="sorry" />);
    const sorryMarkup = sorry.innerHTML;
    cleanup();
    const { container: glitch } = render(<Mascot pose="glitch" />);

    expect(glitch.innerHTML.replace(/data-pose="\w+"/, "")).not.toBe(sorryMarkup.replace(/data-pose="\w+"/, ""));
  });

  it("a pose with no drawing yet (refusal) still falls back to idle", () => {
    render(<Mascot pose="refusal" />);
    expect(screen.getByTestId("mascot")).toHaveAttribute("data-pose", "idle");
  });
});
