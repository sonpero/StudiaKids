// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ScreenHeader } from "./ScreenHeader.js";
import { SubjectChip } from "./SubjectChip.js";
import { bubble, button, card, choice, field, iconButton, title } from "./styles.js";

vi.mock("../../lib/progress.js", () => ({ getProgress: () => Promise.resolve({ total: 48, currentStreak: 0, bestStreak: 0 }), starsLabel: () => "48 étoiles" }));
afterEach(cleanup);

const has = (classes: string, ...tokens: string[]) => {
  for (const token of tokens) expect(classes.split(/\s+/), token).toContain(token);
};

// docs/design/*.png and tokens.md, "Formes": the shared look of every screen.
describe("shared styles", () => {
  it("action buttons: 56px, ink outline, card radius, hard shadow; primary mandarine, secondary turquoise", () => {
    has(button.primary, "h-14", "border-3", "border-ink", "rounded-carte", "bg-mandarine", "shadow-primaire", "font-display", "text-ink");
    has(button.secondary, "h-14", "border-3", "rounded-carte", "bg-turquoise", "shadow-moyenne");
    has(button.dashed, "h-14", "border-3", "border-dashed", "rounded-carte");
    has(button.quiet, "min-h-11", "underline");
  });

  it("an icon button is a 44px square with the icon-button radius", () => {
    has(iconButton, "h-11", "w-11", "rounded-bouton", "border-3", "shadow-petite");
  });

  it("cards, fields and bubbles share the ink outline and the card radius", () => {
    has(card, "border-3", "border-ink", "rounded-carte", "bg-white", "shadow-moyenne");
    has(field, "h-14", "border-3", "rounded-carte", "bg-white", "focus:border-mandarine");
    has(bubble, "border-3", "rounded-carte");
    has(title, "font-display", "text-titre");
  });

  it("a chosen answer takes the active peach, never the sun kept for stars and the mascot", () => {
    has(choice(true), "bg-peche", "border-3", "rounded-carte");
    has(choice(false), "bg-white");
    expect(choice(true)).not.toContain("soleil");
  });
});

describe("SubjectChip", () => {
  it("is the subject's pastel square with its first two letters, hidden from screen readers", () => {
    const { container } = render(<SubjectChip subject="maths" color="matiere-maths" />);
    const chip = container.firstElementChild as HTMLElement;
    expect(chip).toHaveTextContent("Ma");
    expect(chip).toHaveAttribute("aria-hidden", "true");
    expect(chip.style.backgroundColor).toBe("var(--matiere-maths)");
    has(chip.className, "h-11", "w-11", "border-3", "rounded-bouton");
  });

  it("without a subject, the chip stays, blank", () => {
    const { container } = render(<SubjectChip subject={null} color="matiere-autre" />);
    expect(container.firstElementChild).toHaveTextContent("");
  });
});

describe("ScreenHeader", () => {
  const renderHeader = (onBack?: () => void) =>
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ScreenHeader title="Dictée flash" back={onBack ? { label: "Tous les jeux", icon: "close", onClick: onBack } : undefined} />
      </QueryClientProvider>,
    );

  it("a centred title, a square back button named by its action, the star pill", async () => {
    const onBack = vi.fn();
    renderHeader(onBack);
    expect(screen.getByRole("heading", { name: "Dictée flash", level: 1 })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tous les jeux" }));
    expect(onBack).toHaveBeenCalled();
    expect(await screen.findByTestId("star-counter")).toBeInTheDocument();
  });

  it("without a back action, no button — the title stays centred", () => {
    renderHeader();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
