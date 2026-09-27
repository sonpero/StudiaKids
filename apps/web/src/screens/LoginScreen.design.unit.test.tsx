// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LoginScreen } from "./LoginScreen.js";

vi.mock("../lib/api.js", () => ({ login: vi.fn() }));
afterEach(cleanup);

const has = (element: Element | null | undefined, ...tokens: string[]) => {
  for (const token of tokens) expect(element?.className.split(/\s+/), token).toContain(token);
};

// No mockup: the mockups' language (docs/design/*.png, tokens.md).
describe("LoginScreen, in the mockups' language", () => {
  it("the name as a big Baloo title; the form in a card; shared fields and primary button", () => {
    render(<LoginScreen onLoggedIn={vi.fn()} />);
    has(screen.getByRole("heading", { name: "StudiaKids" }), "font-display", "text-titre-xl");
    has(screen.getByRole("textbox", { name: "Identifiant" }).closest("form"), "rounded-grande-carte", "border-3", "bg-white", "shadow-grande-carte");
    has(screen.getByRole("textbox", { name: "Identifiant" }), "h-14", "rounded-carte", "focus:border-mandarine");
    has(screen.getByRole("button", { name: "Se connecter" }), "bg-mandarine", "rounded-carte", "shadow-primaire");
  });
});
