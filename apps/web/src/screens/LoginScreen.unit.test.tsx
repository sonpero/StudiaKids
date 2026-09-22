// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LoginScreen } from "./LoginScreen.js";

const { loginMock } = vi.hoisted(() => ({ loginMock: vi.fn() }));
vi.mock("../lib/api.js", () => ({ login: loginMock }));

afterEach(() => {
  cleanup();
  loginMock.mockReset();
});

function fillAndSubmit(username: string, password: string) {
  fireEvent.change(screen.getByLabelText("Identifiant"), { target: { value: username } });
  fireEvent.change(screen.getByLabelText("Mot de passe"), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: "Se connecter" }));
}

describe("LoginScreen", () => {
  it("renders the mascot, the username and password fields, and the submit button", () => {
    render(<LoginScreen onLoggedIn={vi.fn()} />);

    expect(screen.getByTestId("mascot")).toBeInTheDocument();
    expect(screen.getByLabelText("Identifiant")).toBeInTheDocument();
    expect(screen.getByLabelText("Mot de passe")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Se connecter" })).toBeInTheDocument();
  });

  it("calls onLoggedIn when login succeeds", async () => {
    loginMock.mockResolvedValue({ ok: true });
    const onLoggedIn = vi.fn();
    render(<LoginScreen onLoggedIn={onLoggedIn} />);

    fillAndSubmit("alex", "correct-horse");

    await waitFor(() => expect(onLoggedIn).toHaveBeenCalledOnce());
    expect(loginMock).toHaveBeenCalledWith("alex", "correct-horse");
  });

  it("shows a plain-language message on invalid credentials, without calling onLoggedIn", async () => {
    loginMock.mockResolvedValue({ ok: false, error: "invalid_credentials" });
    const onLoggedIn = vi.fn();
    render(<LoginScreen onLoggedIn={onLoggedIn} />);

    fillAndSubmit("alex", "wrong");

    expect(await screen.findByRole("alert")).toHaveTextContent("Identifiant ou mot de passe incorrect.");
    expect(onLoggedIn).not.toHaveBeenCalled();
  });

  it("shows a plain-language message when rate-limited", async () => {
    loginMock.mockResolvedValue({ ok: false, error: "rate_limited" });
    render(<LoginScreen onLoggedIn={vi.fn()} />);

    fillAndSubmit("alex", "wrong");

    expect(await screen.findByRole("alert")).toHaveTextContent(/trop/i);
  });
});
