import { describe, expect, it } from "vitest";
import { generationStatus } from "./generation-status.js";

// docs/modules/exercise-generator.md: only the split outcome is stored;
// the rest is derived from the jobs, like `failed` at M2.
describe("generationStatus", () => {
  it("not_started without any split job", () => {
    expect(generationStatus(null, null, [])).toEqual({ status: "not_started", done: 0, total: 0, failed: 0 });
  });

  it("splitting while the split job waits or runs", () => {
    expect(generationStatus(null, "pending", []).status).toBe("splitting");
    expect(generationStatus(null, "running", []).status).toBe("splitting");
  });

  it("failed when the split job gave up without an outcome", () => {
    expect(generationStatus(null, "failed", []).status).toBe("failed");
  });

  it("insufficient_coverage as stored, whatever the jobs", () => {
    expect(generationStatus("insufficient_coverage", "done", []).status).toBe("insufficient_coverage");
  });

  it("generating while a type job waits or runs, counted in types", () => {
    expect(generationStatus("items_ready", "done", ["done", "running", "pending", "failed"])).toEqual({ status: "generating", done: 1, total: 4, failed: 1 });
  });

  it("ready once every type job is over, even if some failed", () => {
    expect(generationStatus("items_ready", "done", ["done", "failed", "done"])).toEqual({ status: "ready", done: 2, total: 3, failed: 1 });
  });

  it("failed when every type job failed", () => {
    expect(generationStatus("items_ready", "done", ["failed", "failed"])).toEqual({ status: "failed", done: 0, total: 2, failed: 2 });
  });

  it("generating while the type jobs are not enqueued yet", () => {
    expect(generationStatus("items_ready", "done", []).status).toBe("generating");
  });
});
