import { describe, expect, it } from "vitest";
import { aggregate, costUsd, scoreCase, type CaseRun } from "./scoring.js";

const exercise = (type: string, over: Partial<CaseRun["exercises"][number]> = {}): CaseRun["exercises"][number] => ({
  type,
  shapeOk: true,
  mechanical: null,
  judge: { anchored: true, chatty: false },
  ...over,
});

const run = (over: Partial<CaseRun> = {}): CaseRun => ({
  id: "c",
  calc: false,
  short: false,
  outcome: "items_ready",
  itemCount: 10,
  exercises: [exercise("mcq"), exercise("true_false"), exercise("cloze")],
  costUsd: 0.05,
  ...over,
});

// docs/modules/exercise-generator.md, "Évaluation": anchoring first, then
// answer leaks, chatty blanks, variety, validity.
describe("scoreCase", () => {
  it("anchoring counts shape-valid exercises that pass the mechanical check and the judge", () => {
    const score = scoreCase(run({ exercises: [exercise("mcq"), exercise("mcq", { mechanical: "absente" }), exercise("mcq", { judge: { anchored: false, chatty: false } }), exercise("mcq", { shapeOk: false, judge: null })] }));
    expect(score.anchoring).toBeCloseTo(1 / 3);
    expect(score.validity).toBeCloseTo(2 / 4);
  });

  it("an exercise the judge did not see counts on its mechanical check alone", () => {
    expect(scoreCase(run({ exercises: [exercise("delayed_copy", { judge: null })] })).anchoring).toBe(1);
  });

  it("counts true/false that give their answer away, and chatty or pointless blanks", () => {
    const score = scoreCase(
      run({
        exercises: [
          exercise("true_false", { mechanical: "vrai/faux : la phrase donne sa réponse" }),
          exercise("true_false"),
          exercise("cloze", { judge: { anchored: true, chatty: true } }),
          exercise("cloze"),
          exercise("cloze"),
          exercise("cloze"),
        ],
      }),
    );
    expect(score.trueFalseLeaks).toBeCloseTo(1 / 2);
    expect(score.chattyCloze).toBeCloseTo(1 / 4);
  });

  it("variety: distinct types, mcq's share, and whether a calculation lesson got mental_math", () => {
    const calc = scoreCase(run({ calc: true, exercises: [exercise("mcq"), exercise("mcq"), exercise("mental_math")] }));
    expect(calc.types).toBe(2);
    expect(calc.mcqShare).toBeCloseTo(2 / 3);
    expect(calc.mentalMath).toBe(true);
    expect(scoreCase(run({ calc: true })).mentalMath).toBe(false);
    expect(scoreCase(run()).mentalMath).toBeNull();
  });

  it("coverage is right when a short lesson is refused and a full one is ready", () => {
    expect(scoreCase(run({ short: true, outcome: "insufficient_coverage", itemCount: 3, exercises: [] })).coverageOk).toBe(true);
    expect(scoreCase(run({ short: true })).coverageOk).toBe(false);
    expect(scoreCase(run({ outcome: "insufficient_coverage", exercises: [] })).coverageOk).toBe(false);
  });
});

describe("aggregate", () => {
  it("pools the rates over all exercises, not over cases, and adds the cost", () => {
    const total = aggregate([
      scoreCase(run({ exercises: [exercise("mcq")] })),
      scoreCase(run({ exercises: [exercise("mcq", { mechanical: "x" }), exercise("mcq", { mechanical: "x" }), exercise("mcq", { mechanical: "x" })] })),
    ]);
    expect(total.anchoring).toBeCloseTo(1 / 4);
    expect(total.cases).toBe(2);
    expect(total.costUsd).toBeCloseTo(0.1);
  });

  it("counts coverage mistakes and calculation lessons without mental_math", () => {
    const total = aggregate([scoreCase(run({ short: true })), scoreCase(run({ calc: true })), scoreCase(run({ calc: true, exercises: [exercise("mental_math")] }))]);
    expect(total.coverageMistakes).toBe(1);
    expect(total.calcLessonsWithMentalMath).toBe("1/2");
  });
});

describe("costUsd", () => {
  it("prices claude-sonnet-5 tokens (2 USD in, 10 USD out per million)", () => {
    expect(costUsd({ input: 1_000_000, output: 0 })).toBeCloseTo(2);
    expect(costUsd({ input: 5106, output: 342 })).toBeCloseTo(0.013632);
  });
});
