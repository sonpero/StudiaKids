import { afterEach, describe, expect, it, vi } from "vitest";
import { getProgress, starsLabel } from "./progress.js";

afterEach(() => vi.unstubAllGlobals());

function stubFetch(status: number, body?: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(body === undefined ? null : JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("progress API client", () => {
  it("reads the account's counters, and since an instant the session's", async () => {
    const fetchMock = stubFetch(200, { total: 12, currentStreak: 2, bestStreak: 5 });
    expect(await getProgress()).toEqual({ total: 12, currentStreak: 2, bestStreak: 5 });
    expect(fetchMock).toHaveBeenCalledWith("/api/progress");

    const withSince = stubFetch(200, { total: 12, currentStreak: 2, bestStreak: 5, starsSince: 3, successesSince: 4 });
    expect(await getProgress("2026-09-26T10:00:00.000Z")).toMatchObject({ starsSince: 3 });
    expect(withSince).toHaveBeenCalledWith("/api/progress?since=2026-09-26T10%3A00%3A00.000Z");
  });

  it("throws on an unexpected status", async () => {
    stubFetch(500);
    await expect(getProgress()).rejects.toThrow();
  });

  it("says the stars in words, singular up to one", () => {
    expect([0, 1, 2, 12].map(starsLabel)).toEqual(["0 étoile", "1 étoile", "2 étoiles", "12 étoiles"]);
  });
});
