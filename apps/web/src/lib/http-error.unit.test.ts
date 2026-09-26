import { afterEach, describe, expect, it, vi } from "vitest";
import { listCourses } from "./courses.js";
import { HttpError } from "./http-error.js";

afterEach(() => vi.unstubAllGlobals());

describe("HTTP errors carry their status", () => {
  it("an unexpected status becomes an HttpError with that status, for the retry policy", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })));

    const error: unknown = await listCourses().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).status).toBe(404);
    expect((error as HttpError).message).toMatch(/404/);
  });
});
