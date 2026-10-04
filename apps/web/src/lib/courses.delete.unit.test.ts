import { afterEach, describe, expect, it, vi } from "vitest";
import { deleteCourse } from "./courses.js";

afterEach(() => vi.unstubAllGlobals());

function stubFetch(status: number) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(status === 204 ? null : "{}", { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

// Deleting a confirmed course (2026-10-04).
describe("deleteCourse", () => {
  it("sends DELETE /api/courses/:id", async () => {
    const fetchMock = stubFetch(204);
    await deleteCourse("c1");
    expect(fetchMock).toHaveBeenCalledWith("/api/courses/c1", { method: "DELETE" });
  });

  it("a course already gone (404, deleted from another device) is deleted all the same", async () => {
    stubFetch(404);
    await expect(deleteCourse("c1")).resolves.toBeUndefined();
  });

  it("any other failure is an error", async () => {
    stubFetch(500);
    await expect(deleteCourse("c1")).rejects.toThrow();
  });
});
