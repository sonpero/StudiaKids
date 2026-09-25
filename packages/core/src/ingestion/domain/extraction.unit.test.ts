import { describe, expect, it } from "vitest";
import { displayStatus, outcomeOfPages } from "./extraction.js";
import type { Page } from "./types.js";

function page(index: number, legible: boolean | null, isCoursePage: boolean | null = legible === null ? null : true): Page {
  return {
    courseId: "c1",
    index,
    sha256: `hash-${String(index)}`,
    storedPath: `photos/u1/c1/${String(index)}.jpg`,
    sizeBytes: 100,
    legible,
    isCoursePage,
    unusableReason: legible === false || isCoursePage === false ? "une raison" : null,
  };
}

describe("outcomeOfPages", () => {
  it("is ready only when every page is legible and a course page", () => {
    expect(outcomeOfPages([page(0, true), page(1, true)])).toBe("ready");
  });

  it("is illegible as soon as one page is, and never ready: legibility gates everything after it", () => {
    expect(outcomeOfPages([page(0, true), page(1, false), page(2, null)])).toBe("illegible");
  });

  it("is not_a_course_page when a legible page shows no lesson", () => {
    expect(outcomeOfPages([page(0, true), page(1, true, false)])).toBe("not_a_course_page");
  });

  it("puts illegible first: the content of a photo that cannot be read is never judged", () => {
    expect(outcomeOfPages([page(0, true, false), page(1, false)])).toBe("illegible");
  });

  it("is in_progress while a page is still unprocessed and none is unusable", () => {
    expect(outcomeOfPages([page(0, true), page(1, null)])).toBe("in_progress");
  });

  it("is in_progress when a legible page has not been judged as a course page yet", () => {
    expect(outcomeOfPages([page(0, true, null)])).toBe("in_progress");
  });

  it("is in_progress for a course with no page at all, never ready", () => {
    expect(outcomeOfPages([])).toBe("in_progress");
  });
});

describe("displayStatus", () => {
  it("shows failed when the latest extract-course job has failed and no result was stored", () => {
    expect(displayStatus("running", "failed")).toBe("failed");
    expect(displayStatus("pending", "failed")).toBe("failed");
  });

  it("keeps running while the job is only waiting for a retry", () => {
    expect(displayStatus("running", "pending")).toBe("running");
  });

  it("keeps the stored status when there is no job yet", () => {
    expect(displayStatus("pending", null)).toBe("pending");
  });

  it("never lets a job failure hide a result that was actually stored", () => {
    expect(displayStatus("ready", "failed")).toBe("ready");
    expect(displayStatus("illegible", "failed")).toBe("illegible");
    expect(displayStatus("not_a_course_page", "failed")).toBe("not_a_course_page");
  });
});
