import { describe, expect, it } from "vitest";
import { HttpError } from "./http-error.js";
import { createQueryClient, shouldRetry } from "./query-client.js";

// Decided at M2: one retry at most, none on a 404 (a course replaced
// meanwhile is an answer, not a failure). A child waits ~1 s before the
// error state instead of ~7 s with TanStack Query's default three.
describe("shouldRetry", () => {
  it("retries a failure once, never twice", () => {
    expect(shouldRetry(0, new HttpError(500, "GET /api/courses"))).toBe(true);
    expect(shouldRetry(1, new HttpError(500, "GET /api/courses"))).toBe(false);
  });

  it("retries a network failure once too", () => {
    expect(shouldRetry(0, new TypeError("Failed to fetch"))).toBe(true);
    expect(shouldRetry(1, new TypeError("Failed to fetch"))).toBe(false);
  });

  it("never retries a 404", () => {
    expect(shouldRetry(0, new HttpError(404, "GET /api/courses/c1"))).toBe(false);
  });
});

describe("createQueryClient", () => {
  it("applies that policy to every query", () => {
    expect(createQueryClient().getDefaultOptions().queries?.retry).toBe(shouldRetry);
  });
});
