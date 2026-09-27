// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TabBar } from "./TabBar.js";

afterEach(cleanup);

// docs/ui.md, "Navigation": Accueil, Lire, Jouer, and Tuteur since M6
// (decided at M6's opening: this test's list grew by its fourth tab).
describe("TabBar", () => {
  it("shows the four destinations with their labels, the current one marked", () => {
    render(<TabBar current="play" onHome={vi.fn()} onRead={vi.fn()} onPlay={vi.fn()} onTutor={vi.fn()} />);
    const tabs = within(screen.getByRole("navigation", { name: "Onglets" }));

    expect(tabs.getAllByRole("button").map((button) => button.textContent)).toEqual(["Accueil", "Lire", "Jouer", "Tuteur"]);
    expect(tabs.getByRole("button", { name: "Jouer" })).toHaveAttribute("aria-current", "page");
    expect(tabs.getByRole("button", { name: "Lire" })).not.toHaveAttribute("aria-current");
  });

  it("each tab leads to its screen", () => {
    const onHome = vi.fn();
    const onRead = vi.fn();
    const onPlay = vi.fn();
    const onTutor = vi.fn();
    render(<TabBar current="read" onHome={onHome} onRead={onRead} onPlay={onPlay} onTutor={onTutor} />);

    fireEvent.click(screen.getByRole("button", { name: "Accueil" }));
    fireEvent.click(screen.getByRole("button", { name: "Lire" }));
    fireEvent.click(screen.getByRole("button", { name: "Jouer" }));
    fireEvent.click(screen.getByRole("button", { name: "Tuteur" }));

    expect([onHome, onRead, onPlay, onTutor].map((fn) => fn.mock.calls.length)).toEqual([1, 1, 1, 1]);
  });
});

// docs/design/tuteur.png and docs/ui.md, "Navigation": the tab bar as the
// mockup draws it.
describe("TabBar, as drawn in the mockup", () => {
  const renderBar = () => render(<TabBar current="tutor" onHome={vi.fn()} onRead={vi.fn()} onPlay={vi.fn()} onTutor={vi.fn()} />);

  it("sits on cream, safe area included, under a 3px ink border", () => {
    renderBar();
    const nav = screen.getByRole("navigation", { name: "Onglets" });
    expect(nav.className).toContain("bg-[var(--color-canvas)]");
    expect(nav.className).toContain("border-t-[3px]");
    expect(nav.className).toContain("pb-[env(safe-area-inset-bottom)]");
    expect(nav.className).not.toContain("bg-white");
  });

  it("each tab: a line icon above its label, four equal widths, 44px at least", () => {
    renderBar();
    for (const button of within(screen.getByRole("navigation", { name: "Onglets" })).getAllByRole("button")) {
      const icon = button.querySelector("svg");
      expect(icon, button.textContent ?? "").not.toBeNull();
      expect(icon).toHaveAttribute("aria-hidden", "true");
      expect(icon).toHaveAttribute("stroke-width", "2");
      expect(button.className).toContain("flex-1");
      expect(button.className).toContain("min-h-[44px]");
      expect(button.className).toContain("font-[family-name:var(--font-display)]");
    }
  });

  it("the current tab is a peach pill with an ink outline, never sun yellow", () => {
    renderBar();
    const tabs = within(screen.getByRole("navigation", { name: "Onglets" }));
    const pill = tabs.getByRole("button", { name: "Tuteur" }).querySelector("[data-pill]");
    expect(tabs.getByRole("button", { name: "Tuteur" })).toHaveAttribute("aria-current", "page");
    expect(pill?.className).toContain("bg-[var(--color-peche)]");
    expect(pill?.className).toContain("border-[3px]");
    expect(pill?.className).toContain("rounded-[20px]");
    expect(tabs.getByRole("button", { name: "Lire" }).querySelector("[data-pill]")?.className ?? "").not.toContain("peche");
    expect(screen.getByRole("navigation", { name: "Onglets" }).innerHTML).not.toContain("soleil");
  });
});
