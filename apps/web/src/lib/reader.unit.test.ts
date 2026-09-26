import { afterEach, describe, expect, it, vi } from "vitest";
import { getCourseText } from "./reader.js";

afterEach(() => vi.unstubAllGlobals());

function stubFetch(status: number, body?: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(body === undefined ? null : JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("reader API client", () => {
  it("getCourseText reads the text, the text to speak and the photos", async () => {
    const text = { markdown: "# Le verbe", speech: "Le verbe", photos: [{ index: 0 }] };
    const fetchMock = stubFetch(200, text);

    expect(await getCourseText("c1")).toEqual(text);
    expect(fetchMock).toHaveBeenCalledWith("/api/courses/c1/text");
  });

  it("a deleted course (404) is null; any other failure throws, for the error state", async () => {
    stubFetch(404, { error: "not_found" });
    expect(await getCourseText("c1")).toBeNull();

    stubFetch(500);
    await expect(getCourseText("c1")).rejects.toThrow();
  });
});
