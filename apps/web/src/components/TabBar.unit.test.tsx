// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TabBar } from "./TabBar.js";

afterEach(cleanup);

// docs/ui.md, "Navigation": Accueil, Lire, Jouer (Tuteur in M6).
describe("TabBar", () => {
  it("shows the three destinations with their labels, the current one marked", () => {
    render(<TabBar current="play" onHome={vi.fn()} onRead={vi.fn()} onPlay={vi.fn()} />);
    const tabs = within(screen.getByRole("navigation", { name: "Onglets" }));

    expect(tabs.getAllByRole("button").map((button) => button.textContent)).toEqual(["Accueil", "Lire", "Jouer"]);
    expect(tabs.getByRole("button", { name: "Jouer" })).toHaveAttribute("aria-current", "page");
    expect(tabs.getByRole("button", { name: "Lire" })).not.toHaveAttribute("aria-current");
  });

  it("each tab leads to its screen", () => {
    const onHome = vi.fn();
    const onRead = vi.fn();
    const onPlay = vi.fn();
    render(<TabBar current="read" onHome={onHome} onRead={onRead} onPlay={onPlay} />);

    fireEvent.click(screen.getByRole("button", { name: "Accueil" }));
    fireEvent.click(screen.getByRole("button", { name: "Lire" }));
    fireEvent.click(screen.getByRole("button", { name: "Jouer" }));

    expect([onHome, onRead, onPlay].map((fn) => fn.mock.calls.length)).toEqual([1, 1, 1]);
  });
});
