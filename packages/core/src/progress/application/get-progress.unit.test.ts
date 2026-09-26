import { describe, expect, it } from "vitest";
import type { AttemptEvent } from "../domain/progress.js";
import { getProgress } from "./get-progress.js";

const right = (exerciseId: string, attemptedAt: string): AttemptEvent => ({ exerciseId, attemptedAt, correct: true, starEligible: true });
const history: Record<string, AttemptEvent[]> = {
  u1: [right("e1", "2026-01-15T10:00:00.000Z"), { exerciseId: "e2", attemptedAt: "2026-01-15T10:01:00.000Z", correct: false, starEligible: true }, right("e2", "2026-01-15T10:02:00.000Z")],
  u2: [right("x", "2026-01-15T10:00:00.000Z"), right("y", "2026-01-15T10:01:00.000Z")],
};
const deps = { attempts: { listByUser: (userId: string) => Promise.resolve(history[userId] ?? []) } };

// docs/modules/progress.md: counters read from the account's attempts, in
// Paris time; nothing stored.
describe("getProgress", () => {
  it("gives the total and the streaks of the account only", async () => {
    expect(await getProgress(deps, "u1", {})).toEqual({ total: 2, currentStreak: 1, bestStreak: 1 });
    expect(await getProgress(deps, "nobody", {})).toEqual({ total: 0, currentStreak: 0, bestStreak: 0 });
  });

  it("with since: the stars and right answers since then, for the session summary", async () => {
    expect(await getProgress(deps, "u1", { since: "2026-01-15T10:01:00.000Z" })).toEqual({ total: 2, currentStreak: 1, bestStreak: 1, starsSince: 1, successesSince: 1 });
  });

  it("with a submission: what that answer earned and its celebration", async () => {
    expect(await getProgress(deps, "u1", { submission: { exerciseId: "e2", at: "2026-01-15T10:02:00.000Z" } })).toEqual({
      total: 2,
      currentStreak: 1,
      bestStreak: 1,
      submission: { stars: 1, celebrate: "comeback" },
    });
    expect(await getProgress(deps, "u1", { submission: { exerciseId: "e2", at: "2026-01-15T10:01:00.000Z" } })).toMatchObject({ submission: { stars: 0, celebrate: null } });
    expect(await getProgress(deps, "u1", { submission: { exerciseId: "zz", at: "2026-01-15T10:01:00.000Z" } })).toMatchObject({ submission: { stars: 0, celebrate: null } });
  });
});
