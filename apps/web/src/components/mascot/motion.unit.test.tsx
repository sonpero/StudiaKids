// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Mascot, type MascotPose } from "./Mascot.js";

afterEach(cleanup);

// docs/ui.md "Icônes et mouvement" and docs/modules/mascot.md (M5): the
// joy dance is asked for by the screen; every animation has a still
// version under prefers-reduced-motion.
describe("Mascot, motion", () => {
  it("dances only when asked: the joy pose carries data-motion=dance", () => {
    render(<Mascot pose="joy" motion="dance" />);
    expect(screen.getByTestId("mascot")).toHaveAttribute("data-motion", "dance");
    cleanup();

    render(<Mascot pose="joy" />);
    expect(screen.getByTestId("mascot")).not.toHaveAttribute("data-motion");
  });

  it("every pose can be asked to dance without losing its pose", () => {
    for (const pose of ["idle", "watching", "waiting", "joy", "sorry", "glitch"] as MascotPose[]) {
      render(<Mascot pose={pose} motion="dance" />);
      expect(screen.getByTestId("mascot")).toHaveAttribute("data-pose", pose);
      expect(screen.getByTestId("mascot")).toHaveAttribute("data-motion", "dance");
      cleanup();
    }
  });
});
