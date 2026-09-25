import { describe, expect, it } from "vitest";
import { canAddPage, MAX_PAGES_PER_COURSE, nextPageIndex } from "./pages.js";

describe("nextPageIndex", () => {
  it("returns 0 for the first page of a course", () => {
    expect(nextPageIndex([])).toBe(0);
  });

  it("returns the next contiguous index", () => {
    expect(nextPageIndex([0, 1, 2])).toBe(3);
  });
});

describe("canAddPage", () => {
  it("caps a course at 5 pages", () => {
    expect(MAX_PAGES_PER_COURSE).toBe(5);
  });

  it("allows pages up to the cap, never a sixth", () => {
    expect(canAddPage(0)).toBe(true);
    expect(canAddPage(4)).toBe(true);
    expect(canAddPage(5)).toBe(false);
    expect(canAddPage(6)).toBe(false);
  });
});
