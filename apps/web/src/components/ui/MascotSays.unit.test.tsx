// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MascotSays } from "./MascotSays.js";

afterEach(cleanup);

// The mascot speaking, as on docs/design/accueil.png: its sentence in a
// white speech bubble pointing at it — for every screen's states.
describe("MascotSays", () => {
  it("the sentence in a bubble with a tail, the mascot under it in its pose", () => {
    render(<MascotSays pose="glitch" line="Oh, quelque chose a coincé. On réessaie ?" />);
    const bubble = screen.getByText("Oh, quelque chose a coincé. On réessaie ?");
    expect(bubble).toHaveAttribute("data-bubble");
    for (const token of ["bg-white", "border-3", "rounded-carte"]) expect(bubble.className).toContain(token);
    expect(screen.getByTestId("mascot")).toHaveAttribute("data-pose", "glitch");
    expect(bubble.compareDocumentPosition(screen.getByTestId("mascot")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("an alert is said as one", () => {
    render(<MascotSays pose="sorry" line="Tu as déjà pris cette page !" role="alert" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Tu as déjà pris cette page !");
  });
});
