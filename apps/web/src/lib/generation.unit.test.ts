import { afterEach, describe, expect, it, vi } from "vitest";
import { generationPollInterval, getGenerationStatus, startGeneration } from "./generation.js";

afterEach(() => vi.unstubAllGlobals());

function stubFetch(status: number, body?: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(body === undefined ? null : JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const splitting = { status: "splitting", done: 0, total: 0, failed: 0, itemCount: 0 };

describe("generation API client", () => {
  it("startGeneration posts « Créer mes jeux » and returns the status it answers", async () => {
    const fetchMock = stubFetch(202, splitting);

    expect(await startGeneration("c1")).toEqual(splitting);
    expect(fetchMock).toHaveBeenCalledWith("/api/courses/c1/generate", { method: "POST" });
  });

  it("getGenerationStatus reads the status; a deleted course (404) is null; any other failure throws", async () => {
    const fetchMock = stubFetch(200, splitting);
    expect(await getGenerationStatus("c1")).toEqual(splitting);
    expect(fetchMock).toHaveBeenCalledWith("/api/courses/c1/generation-status");

    stubFetch(404, { error: "not_found" });
    expect(await getGenerationStatus("c1")).toBeNull();

    stubFetch(500);
    await expect(getGenerationStatus("c1")).rejects.toThrow();
    stubFetch(500);
    await expect(startGeneration("c1")).rejects.toThrow();
  });

  it("polls while the games are being made, slower after 30 seconds, never once it is over", () => {
    expect(generationPollInterval("splitting", 0)).toBe(1000);
    expect(generationPollInterval("generating", 29_999)).toBe(1000);
    expect(generationPollInterval("generating", 30_000)).toBe(5000);
    for (const status of ["not_started", "ready", "insufficient_coverage", "failed"] as const) expect(generationPollInterval(status, 0)).toBe(false);
  });
});
