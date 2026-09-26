import { describe, expect, it } from "vitest";
import { extractionStarted } from "./extraction.js";

// A course still `pending` may be waiting for its job, or may never have
// been sent to reading at all (the child left the capture screen before
// « C'est tout ! »). Only the second one goes back to the capture.
describe("extractionStarted", () => {
  it("is false for a pending course with no extract-course job yet", () => {
    expect(extractionStarted("pending", null)).toBe(false);
  });

  it("is true as soon as a job exists, whatever its state", () => {
    for (const job of ["pending", "running", "done", "failed"] as const) expect(extractionStarted("pending", job)).toBe(true);
  });

  it("is true for any status past pending, job or not", () => {
    for (const stored of ["running", "illegible", "not_a_course_page", "ready"] as const) expect(extractionStarted(stored, null)).toBe(true);
  });
});
