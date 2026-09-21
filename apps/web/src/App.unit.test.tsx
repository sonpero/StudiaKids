// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "./App.js";

afterEach(cleanup);

describe("App (M0 placeholder homepage)", () => {
  it("renders the mascot in the idle pose", () => {
    render(<App />);
    expect(screen.getByTestId("mascot")).toBeInTheDocument();
  });

  it("shows the app name", () => {
    render(<App />);
    expect(screen.getByText("StudiaKids")).toBeInTheDocument();
  });
});
