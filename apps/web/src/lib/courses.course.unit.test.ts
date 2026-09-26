import { afterEach, describe, expect, it, vi } from "vitest";
import { confirmCourse, getCourse, getUnconfirmedCourse, pageFileUrl, pollInterval, rejectCourse, retryExtraction } from "./courses.js";

afterEach(() => vi.unstubAllGlobals());

const course = {
  id: "c1",
  title: "",
  subject: null,
  grade: "CM1",
  color: "",
  extractionStatus: "running",
  confirmed: false,
  pageCount: 1,
  createdAt: "2026-09-26T10:00:00.000Z",
  lastAccessedAt: "2026-09-26T10:00:00.000Z",
};

function stubFetch(status: number, body?: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(body === undefined ? null : JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("course API client", () => {
  it("getCourse reads one course; a 404 (replaced meanwhile) is null, not an error", async () => {
    stubFetch(200, course);
    expect(await getCourse("c1")).toEqual(course);

    stubFetch(404, { error: "not_found" });
    expect(await getCourse("c1")).toBeNull();

    stubFetch(500);
    await expect(getCourse("c1")).rejects.toThrow();
  });

  it("getUnconfirmedCourse reads the account's pending course, or null", async () => {
    const fetchMock = stubFetch(200, { course });
    expect(await getUnconfirmedCourse()).toEqual(course);
    expect(fetchMock).toHaveBeenCalledWith("/api/courses/unconfirmed");

    stubFetch(200, { course: null });
    expect(await getUnconfirmedCourse()).toBeNull();
  });

  it("confirm, reject and retry post to their routes", async () => {
    const fetchMock = stubFetch(204);
    await confirmCourse("c1");
    await rejectCourse("c1");
    stubFetch(202);
    await retryExtraction("c1");

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/courses/c1/confirm", { method: "POST" });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/courses/c1/reject", { method: "POST" });
  });

  it("the page photo is read through the authenticated route, never a static path", () => {
    expect(pageFileUrl("c1", 0)).toBe("/api/courses/c1/pages/0/file");
  });
});

// docs/ui.md, "Travail asynchrone": polled while not final, slowed after
// 30 seconds, stopped once the reading has an outcome.
describe("pollInterval", () => {
  it("polls every second while the reading waits or runs, every five after 30 s", () => {
    expect(pollInterval("pending", 0)).toBe(1000);
    expect(pollInterval("running", 29_999)).toBe(1000);
    expect(pollInterval("running", 30_000)).toBe(5000);
  });

  it("stops once there is an outcome", () => {
    for (const status of ["ready", "illegible", "not_a_course_page", "failed"] as const) expect(pollInterval(status, 0)).toBe(false);
  });
});
