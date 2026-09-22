// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App.js";

const { fetchMeMock, logoutMock } = vi.hoisted(() => ({ fetchMeMock: vi.fn(), logoutMock: vi.fn() }));
vi.mock("./lib/api.js", () => ({ fetchMe: fetchMeMock, logout: logoutMock, login: vi.fn() }));

afterEach(() => {
  cleanup();
  fetchMeMock.mockReset();
  logoutMock.mockReset();
});

function renderApp() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>,
  );
}

describe("App", () => {
  it("shows a loading state (mascot + text) while the session is being checked", () => {
    fetchMeMock.mockReturnValue(new Promise(() => undefined));
    renderApp();

    expect(screen.getByTestId("mascot")).toBeInTheDocument();
    expect(screen.getByText(/on vérifie/i)).toBeInTheDocument();
  });

  it("shows the login screen when there is no session", async () => {
    fetchMeMock.mockResolvedValue(null);
    renderApp();

    expect(await screen.findByRole("button", { name: "Se connecter" })).toBeInTheDocument();
  });

  it("shows an error state with a retry action when the session check fails", async () => {
    fetchMeMock.mockRejectedValue(new Error("boom"));
    renderApp();

    expect(await screen.findByRole("button", { name: /réessaie/i })).toBeInTheDocument();
  });

  it("shows the home screen with the account's first name when logged in", async () => {
    fetchMeMock.mockResolvedValue({ id: "u1", firstName: "Alex", grade: "CP" });
    renderApp();

    expect(await screen.findByText(/Alex/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Se déconnecter" })).toBeInTheDocument();
  });

  it("logs out and returns to the login screen", async () => {
    fetchMeMock.mockResolvedValueOnce({ id: "u1", firstName: "Alex", grade: "CP" });
    logoutMock.mockResolvedValue(undefined);
    renderApp();
    const logoutButton = await screen.findByRole("button", { name: "Se déconnecter" });

    fetchMeMock.mockResolvedValueOnce(null);
    logoutButton.click();

    await waitFor(() => expect(logoutMock).toHaveBeenCalledOnce());
    expect(await screen.findByRole("button", { name: "Se connecter" })).toBeInTheDocument();
  });
});
