import { describe, expect, it } from "vitest";
import { err, ok } from "../../shared/index.js";
import type { Item } from "../domain/ports.js";
import { courseTexts, fakeItemRepository, scriptedGenerator, sequentialIds } from "./fakes.js";
import { regenerateCourse } from "./regenerate-course.js";

// The regeneration of a course already generated (maths courses made
// before the per-subject rules): every game type on its items, once,
// under today's prompts and rules — no job, no new split.
const now = new Date("2026-10-04T10:00:00.000Z");
const MATHS = "# La table de 7\n7 × 2 = 14\n7 × 3 = 21";
const item = (id: string, types: Item["applicableGameTypes"], position: number): Item => ({ id, courseId: "c1", userId: "u1", title: `Item ${id}`, body: "7 × 2 = 14", applicableGameTypes: types, position, createdAt: now.toISOString() });

function setup() {
  const repo = fakeItemRepository();
  repo.items.push(item("i0", ["mental_math", "delayed_copy"], 0), item("i1", ["cloze", "mental_math"], 1));
  return { repo, courses: courseTexts({ c1: MATHS }, "u1", "CE2", { c1: "maths" }), idGenerator: sequentialIds() };
}

describe("regenerateCourse", () => {
  it("asks each allowed type once, for the whole course, and tells which ones failed", async () => {
    const deps = setup();
    const generator = scriptedGenerator({ mental_math: [ok([{ item: 0, question: "7 × 2", answer: 14 }, { item: 1, question: "7 × 3", answer: 21 }])], cloze: [err({ kind: "model-error", message: "down" })] });

    const result = await regenerateCourse({ ...deps, generator }, "u1", "c1", now);

    expect(result).toEqual(ok({ types: ["mental_math", "delayed_copy", "cloze"], failed: ["cloze"] }));
    expect(generator.asked.map((a) => a.type)).toEqual(["mental_math", "cloze"]);
    expect(generator.inputs.every((input) => input.subject === "maths")).toBe(true);
    expect(deps.repo.exercises.map((e) => e.content)).toEqual([
      { type: "mental_math", question: "7 × 2", answer: 14 },
      { type: "mental_math", question: "7 × 3", answer: 21 },
    ]);
  });

  it("a course that is not this account's, or not ready, is refused", async () => {
    const deps = { ...setup(), generator: scriptedGenerator({}) };
    expect(await regenerateCourse(deps, "u2", "c1", now)).toEqual({ ok: false, error: "not-found" });
    expect(deps.generator.asked).toEqual([]);
  });
});
