// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PROGRESS_QUERY_KEY, StarCounter } from "./StarCounter.js";

const api = vi.hoisted(() => ({ getProgress: vi.fn(), starsLabel: (n: number) => `${String(n)} étoile${n > 1 ? "s" : ""}` }));
vi.mock("../lib/progress.js", () => api);

afterEach(() => {
  cleanup();
  api.getProgress.mockReset();
});

// docs/ui.md, "Étoiles, danse, récapitulatif, reprise (M5)".
describe("StarCounter", () => {
  it("shows the account's total, said in words for the screen reader", async () => {
    api.getProgress.mockResolvedValue({ total: 12, currentStreak: 0, bestStreak: 3 });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <StarCounter />
      </QueryClientProvider>,
    );

    const counter = await screen.findByTestId("star-counter");
    expect(counter).toHaveAccessibleName("12 étoiles");
    expect(counter).toHaveTextContent("12");
  });

  it("moves at once when an answer brings a new total, without reading again", async () => {
    api.getProgress.mockResolvedValue({ total: 1, currentStreak: 1, bestStreak: 1 });
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <StarCounter />
      </QueryClientProvider>,
    );
    await screen.findByTestId("star-counter");

    act(() => {
      client.setQueryData(PROGRESS_QUERY_KEY, { total: 2, currentStreak: 2, bestStreak: 2 });
    });

    // TanStack Query notifies its observers asynchronously.
    await waitFor(() => expect(screen.getByTestId("star-counter")).toHaveAccessibleName("2 étoiles"));
    expect(api.getProgress).toHaveBeenCalledTimes(1);
  });

  it("shows nothing while unknown: a counter never guesses", () => {
    api.getProgress.mockReturnValue(new Promise(() => undefined));
    render(
      <QueryClientProvider client={new QueryClient()}>
        <StarCounter />
      </QueryClientProvider>,
    );

    expect(screen.queryByTestId("star-counter")).not.toBeInTheDocument();
  });

  it("bounces when the total rises, never when it stays", async () => {
    api.getProgress.mockResolvedValue({ total: 1, currentStreak: 1, bestStreak: 1 });
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <StarCounter />
      </QueryClientProvider>,
    );
    expect(await screen.findByTestId("star-counter")).not.toHaveAttribute("data-bounce");

    act(() => {
      client.setQueryData(PROGRESS_QUERY_KEY, { total: 1, currentStreak: 0, bestStreak: 1 });
    });
    await waitFor(() => expect(screen.getByTestId("star-counter")).toHaveAccessibleName("1 étoile"));
    expect(screen.getByTestId("star-counter")).not.toHaveAttribute("data-bounce");
    act(() => {
      client.setQueryData(PROGRESS_QUERY_KEY, { total: 3, currentStreak: 2, bestStreak: 2 });
    });

    await waitFor(() => expect(screen.getByTestId("star-counter")).toHaveAttribute("data-bounce"));
  });
});
