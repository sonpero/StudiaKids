import { describe, expect, it } from "vitest";
import { ok } from "../../shared/index.js";
import { courseTexts, fakeItemRepository, fakeJobQueue, scriptedGenerator, scriptedSplitter, sequentialIds } from "./fakes.js";
import { generateExercisesJobHandler, splitItemsJobHandler } from "./job-handlers.js";

// What apps/worker registers at startup (docs/modules/jobs.md).
describe("exercise-generator job handlers", () => {
  const deps = { courses: courseTexts({}), repo: fakeItemRepository(), jobQueue: fakeJobQueue(), idGenerator: sequentialIds() };

  it("split-items only accepts a payload with a course id", () => {
    const handler = splitItemsJobHandler({ ...deps, splitter: scriptedSplitter([]) });
    expect(handler.type).toBe("split-items");
    expect(handler.payloadSchema.safeParse({ courseId: "c1" }).success).toBe(true);
    expect(handler.payloadSchema.safeParse({}).success).toBe(false);
  });

  it("generate-exercises only accepts a known game type, and optional item ids", () => {
    const handler = generateExercisesJobHandler({ ...deps, generator: scriptedGenerator({}) });
    expect(handler.type).toBe("generate-exercises");
    expect(handler.payloadSchema.safeParse({ courseId: "c1", type: "mcq" }).success).toBe(true);
    expect(handler.payloadSchema.safeParse({ courseId: "c1", type: "mcq", itemIds: ["i1"] }).success).toBe(true);
    expect(handler.payloadSchema.safeParse({ courseId: "c1", type: "quiz" }).success).toBe(false);
  });

  it("both run for the job's account and end quietly on a course that is gone", async () => {
    const ctx = { jobId: "j", userId: "u1", attempt: 1, now: new Date() };
    expect(await splitItemsJobHandler({ ...deps, splitter: scriptedSplitter([]) }).handle({ courseId: "gone" }, ctx)).toEqual(ok(undefined));
    expect(await generateExercisesJobHandler({ ...deps, generator: scriptedGenerator({}) }).handle({ courseId: "gone", type: "mcq" }, ctx)).toEqual(ok(undefined));
  });
});
