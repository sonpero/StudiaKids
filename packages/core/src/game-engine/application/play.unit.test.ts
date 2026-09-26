import { describe, expect, it } from "vitest";
import type { Exercise } from "../../exercise-generator/index.js";
import { ok } from "../../shared/index.js";
import { fakeAttemptRepository, fakeExerciseSource, sequentialIds } from "./fakes.js";
import { listAttemptsForProgress } from "./list-attempts-for-progress.js";
import { listPlayableExercises } from "./list-playable-exercises.js";
import { playExercise } from "./play-exercise.js";

const now = new Date("2026-09-26T10:00:00.000Z");
const later = new Date("2026-09-26T10:05:00.000Z");
const exercise = (id: string, content: Exercise["content"], userId = "u1"): Exercise => ({ id, itemId: `i-${id}`, userId, type: content.type, content, createdAt: now.toISOString() });

const flash = exercise("e-copy", { type: "delayed_copy", wordOrPhrase: "chanter" });
const pairs = exercise("e-match", {
  type: "matching",
  pairs: [
    { left: "a", right: "1" },
    { left: "b", right: "2" },
    { left: "c", right: "3" },
    { left: "d", right: "4" },
  ],
});
const theirs = exercise("e-theirs", { type: "true_false", statement: "Vrai.", answer: true }, "u2");

function setup() {
  const exercises = fakeExerciseSource({
    c1: { userId: "u1", exercises: [{ exercise: flash, itemTitle: "Le verbe" }, { exercise: pairs, itemTitle: "Les temps" }] },
    c2: { userId: "u2", exercises: [{ exercise: theirs, itemTitle: "Autre" }] },
    c3: { userId: "u1", ready: false, exercises: [] },
  });
  return { exercises, attempts: fakeAttemptRepository(), idGenerator: sequentialIds() };
}

describe("playExercise", () => {
  it("compares the answer and writes one attempt per unit, scoped to the account, without the answer", async () => {
    const deps = setup();
    const given = { pairs: [{ left: "d", right: "4" }, { left: "a", right: "1" }, { left: "b", right: "3" }, { left: "c", right: "2" }] };

    const result = await playExercise(deps, "u1", "e-match", given, { reread: false }, now);

    // M4 closing decision: a wrong answer brings the right one back.
    expect(result).toEqual(
      ok({ result: { units: [{ id: "0", correct: true }, { id: "1", correct: false }, { id: "2", correct: false }, { id: "3", correct: true }] }, correction: { pairs: pairs.content.type === "matching" ? pairs.content.pairs : [] } }),
    );
    expect(deps.attempts.rows).toHaveLength(4);
    expect(deps.attempts.rows[0]).toEqual({ id: "a-0", userId: "u1", exerciseId: "e-match", type: "matching", unitId: "0", correct: true, starEligible: true, attemptedAt: now.toISOString() });
    expect(JSON.stringify(deps.attempts.rows)).not.toContain('"4"');
  });

  it("never modifies the exercise", async () => {
    const deps = setup();
    const before = JSON.stringify(flash);

    await playExercise(deps, "u1", "e-copy", { text: "chanté" }, { reread: false }, now);

    expect(JSON.stringify(flash)).toBe(before);
    expect(JSON.stringify(deps.attempts.rows)).not.toContain("chanté");
  });

  it("after a reread: the result stays faithful, the attempt is not star-eligible", async () => {
    const deps = setup();

    expect(await playExercise(deps, "u1", "e-copy", { text: "chanter" }, { reread: true }, now)).toEqual(ok({ result: { units: [{ id: "0", correct: true }] } }));
    expect(deps.attempts.rows).toMatchObject([{ correct: true, starEligible: false }]);
  });

  it("another account's exercise, or an unknown one, is not found, and nothing is written", async () => {
    const deps = setup();

    expect(await playExercise(deps, "u1", "e-theirs", { value: true }, { reread: false }, now)).toEqual({ ok: false, error: "not-found" });
    expect(await playExercise(deps, "u1", "nope", { value: true }, { reread: false }, now)).toEqual({ ok: false, error: "not-found" });
    expect(deps.attempts.rows).toEqual([]);
  });

  it("an answer shaped for another type is refused, and nothing is written", async () => {
    const deps = setup();

    expect(await playExercise(deps, "u1", "e-copy", { value: true }, { reread: false }, now)).toEqual({ ok: false, error: "invalid-answer" });
    expect(deps.attempts.rows).toEqual([]);
  });
});

describe("listPlayableExercises", () => {
  it("gives the course's exercises in its order, without any answer, and the next one to play", async () => {
    const deps = setup();

    const result = await listPlayableExercises(deps, "u1", "c1", "CP");

    if (!result.ok) throw new Error(result.error);
    expect(result.value.exercises.map((e) => [e.id, e.type, e.itemTitle])).toEqual([
      ["e-copy", "delayed_copy", "Le verbe"],
      ["e-match", "matching", "Les temps"],
    ]);
    expect(result.value.exercises[0]).toMatchObject({ wordOrPhrase: "chanter", displayDurationMs: 5000 });
    expect(JSON.stringify(result.value)).not.toContain('"pairs"');
    expect(result.value.nextExerciseId).toBe("e-copy");
  });

  it("the next one skips an exercise already succeeded; a reread does not count", async () => {
    const deps = setup();
    await playExercise(deps, "u1", "e-copy", { text: "chanter" }, { reread: true }, now);
    expect(await listPlayableExercises(deps, "u1", "c1", "CP")).toMatchObject({ value: { nextExerciseId: "e-copy" } });

    await playExercise(deps, "u1", "e-copy", { text: "chanter" }, { reread: false }, later);

    expect(await listPlayableExercises(deps, "u1", "c1", "CP")).toMatchObject({ value: { nextExerciseId: "e-match" } });
  });

  it("another account's course is not found; a course not confirmed is not ready", async () => {
    const deps = setup();

    expect(await listPlayableExercises(deps, "u1", "c2", "CP")).toEqual({ ok: false, error: "not-found" });
    expect(await listPlayableExercises(deps, "u1", "c3", "CP")).toEqual({ ok: false, error: "not-ready" });
  });
});

describe("playExercise, the correction", () => {
  it("comes only with a wrong answer", async () => {
    const deps = setup();

    expect(await playExercise(deps, "u1", "e-copy", { text: "chanté" }, { reread: false }, now)).toEqual(ok({ result: { units: [{ id: "0", correct: false }] }, correction: { text: "chanter" } }));
    expect(await playExercise(deps, "u1", "e-copy", { text: "chanter" }, { reread: false }, later)).toEqual(ok({ result: { units: [{ id: "0", correct: true }] } }));
  });
});

// M5: what progress derives the stars from, through game-engine's index.
describe("listAttemptsForProgress", () => {
  it("gives every attempt of the account, never another's", async () => {
    const deps = setup();
    await playExercise(deps, "u1", "e-copy", { text: "chanter" }, { reread: false }, now);
    await deps.attempts.record("u2", [{ id: "x", exerciseId: "e-theirs", type: "true_false", unitId: "0", correct: true, starEligible: true }], now);

    expect(await listAttemptsForProgress(deps, "u1")).toEqual([{ exerciseId: "e-copy", attemptedAt: now.toISOString(), correct: true, starEligible: true }]);
  });
});
