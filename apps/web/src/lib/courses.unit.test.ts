import { afterEach, describe, expect, it, vi } from "vitest";
import { createCourse, listCourses, startExtraction, uploadPage } from "./courses.js";

afterEach(() => vi.unstubAllGlobals());

const course = {
  id: "c1",
  title: "Le verbe",
  subject: "french",
  grade: "CM1",
  color: "matiere-francais",
  extractionStatus: "ready",
  extractionStarted: true,
  confirmed: true,
  pageCount: 1,
  createdAt: "2026-09-26T10:00:00.000Z",
  lastAccessedAt: "2026-09-26T10:00:00.000Z",
};

function stubFetch(status: number, body?: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(body === undefined ? null : JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("courses API client", () => {
  it("listCourses reads the confirmed courses", async () => {
    const fetchMock = stubFetch(200, { courses: [course] });

    expect(await listCourses()).toEqual([course]);
    expect(fetchMock).toHaveBeenCalledWith("/api/courses");
  });

  it("listCourses throws on an unexpected status, for the screen's error state", async () => {
    stubFetch(500);

    await expect(listCourses()).rejects.toThrow();
  });

  it("createCourse posts and returns the new id", async () => {
    const fetchMock = stubFetch(201, { id: "c1" });

    expect(await createCourse()).toBe("c1");
    expect(fetchMock).toHaveBeenCalledWith("/api/courses", { method: "POST" });
  });

  it("uploadPage sends the given blob as one multipart photo and returns its index", async () => {
    const fetchMock = stubFetch(201, { index: 0 });
    const blob = new Blob(["jpeg"], { type: "image/jpeg" });

    expect(await uploadPage("c1", blob)).toEqual({ ok: true, index: 0 });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/courses/c1/pages");
    expect(init.method).toBe("POST");
    expect((init.body as FormData).get("photo")).toBeInstanceOf(Blob);
  });

  it("uploadPage turns a refusal into its stable code, and anything else into upload_failed", async () => {
    stubFetch(409, { error: "duplicate" });
    expect(await uploadPage("c1", new Blob())).toEqual({ ok: false, error: "duplicate" });

    stubFetch(413, { error: "too_large" });
    expect(await uploadPage("c1", new Blob())).toEqual({ ok: false, error: "too_large" });

    stubFetch(502);
    expect(await uploadPage("c1", new Blob())).toEqual({ ok: false, error: "upload_failed" });

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    expect(await uploadPage("c1", new Blob())).toEqual({ ok: false, error: "upload_failed" });
  });

  it("startExtraction posts to the course's extract route", async () => {
    const fetchMock = stubFetch(202, { extractionStatus: "pending" });

    await startExtraction("c1");
    expect(fetchMock).toHaveBeenCalledWith("/api/courses/c1/extract", { method: "POST" });
  });
});
