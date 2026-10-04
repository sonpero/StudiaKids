import { describe, expect, it } from "vitest";
import { detachAttempts } from "./detach-attempts.js";
import { fakeAttemptRepository } from "./fakes.js";

// Deleting a confirmed course (decided on 2026-10-04): its attempts stay,
// detached from their exercises, with only what stars and the streak need.
const day = (n: number) => new Date(Date.UTC(2026, 9, 1 + n, 10));

describe("detachAttempts", () => {
  it("what progress reads is the same before and after: same stars, same streak", async () => {
    const attempts = fakeAttemptRepository();
    await attempts.record("u1", [{ id: "a0", exerciseId: "e1", type: "matching", unitId: "0", correct: true, starEligible: true }, { id: "a1", exerciseId: "e1", type: "matching", unitId: "1", correct: true, starEligible: true }], day(0));
    await attempts.record("u1", [{ id: "a2", exerciseId: "e2", type: "mcq", unitId: "0", correct: false, starEligible: true }], day(1));
    await attempts.record("u1", [{ id: "a3", exerciseId: "e3", type: "mcq", unitId: "0", correct: true, starEligible: true }], day(1));
    const before = await attempts.listByUser("u1");

    await detachAttempts({ attempts }, "u1", ["e1", "e2"]);

    expect(await attempts.listByUser("u1")).toEqual(before);
  });

  it("keeps nothing a star does not need: no game type, no unit", async () => {
    const attempts = fakeAttemptRepository();
    await attempts.record("u1", [{ id: "a0", exerciseId: "e1", type: "cloze", unitId: "0", correct: true, starEligible: true }], day(0));
    await attempts.record("u1", [{ id: "a1", exerciseId: "e9", type: "mcq", unitId: "0", correct: true, starEligible: true }], day(0));
    await attempts.record("u2", [{ id: "a2", exerciseId: "e1", type: "cloze", unitId: "0", correct: true, starEligible: true }], day(0));

    await detachAttempts({ attempts }, "u1", ["e1"]);

    expect(attempts.rows.map((row) => [row.id, row.type, row.unitId])).toEqual([
      ["a0", null, null],
      ["a1", "mcq", "0"],
      ["a2", "cloze", "0"],
    ]);
  });
});
