// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Mascot, type MascotPose } from "./Mascot.js";

afterEach(cleanup);

// docs/ui.md, "Contrat d'API du composant": `size`, "avatar" being the
// round medallion next to each tutor answer (M6).
describe("Mascot size", () => {
  it("is the large size by default, as every screen drew it so far", () => {
    render(<Mascot pose="idle" />);
    expect(screen.getByTestId("mascot")).toHaveAttribute("data-size", "lg");
    expect(screen.getByTestId("mascot")).toHaveAttribute("width", "150");
  });

  it("every pose takes the avatar size, small enough to sit next to an answer", () => {
    for (const pose of ["idle", "watching", "waiting", "joy", "sorry", "glitch", "refusal"] as MascotPose[]) {
      render(<Mascot pose={pose} size="avatar" />);
      const svg = screen.getByTestId("mascot");
      expect(svg, pose).toHaveAttribute("data-size", "avatar");
      expect(Number(svg.getAttribute("width")), pose).toBeLessThanOrEqual(48);
      cleanup();
    }
  });
});
