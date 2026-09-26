import { describe, expect, it } from "vitest";
import { attemptsFor, displayDurationMs, isSuccess, nextExercise, playableView } from "./play.js";

// docs/modules/game-engine.md, "Copie différée" and the M4 criterion:
// a reread never writes a success event (a correct, star-eligible attempt).
describe("attemptsFor", () => {
  const allRight = { units: [{ id: "0", correct: true }] };
  const mixed = { units: [{ id: "0", correct: true }, { id: "1", correct: false }] };

  it("without a reread: one attempt per unit, faithful and star-eligible", () => {
    expect(attemptsFor(mixed, { reread: false })).toEqual([
      { unitId: "0", correct: true, starEligible: true },
      { unitId: "1", correct: false, starEligible: true },
    ]);
  });

  it("after a reread: still faithful, never star-eligible — so never a success event", () => {
    const attempts = attemptsFor(allRight, { reread: true });
    expect(attempts).toEqual([{ unitId: "0", correct: true, starEligible: false }]);
    expect(attempts.some(isSuccess)).toBe(false);
    expect(attemptsFor(mixed, { reread: true }).some(isSuccess)).toBe(false);
  });

  it("a success event is a correct and star-eligible attempt, nothing else", () => {
    expect(isSuccess({ correct: true, starEligible: true })).toBe(true);
    expect(isSuccess({ correct: true, starEligible: false })).toBe(false);
    expect(isSuccess({ correct: false, starEligible: true })).toBe(false);
  });
});

describe("displayDurationMs", () => {
  it("is the spec's duration per grade, shorter as the child grows", () => {
    expect(["CP", "CE1", "CE2", "CM1", "CM2", "6e"].map((grade) => displayDurationMs(grade as "CP"))).toEqual([5000, 4000, 3500, 3000, 2500, 2000]);
  });
});

describe("playableView", () => {
  const base = { id: "e-42", itemTitle: "Le verbe" };

  it("never carries the answer of a question", () => {
    const mcq = playableView({ ...base, content: { type: "mcq", question: "Qui ?", options: ["a", "b", "c", "d"], answer: "a" } }, "CM1");
    expect(mcq).toEqual({ ...base, type: "mcq", question: "Qui ?", options: expect.arrayContaining(["a", "b", "c", "d"]) as unknown });
    expect(mcq).not.toHaveProperty("answer");
    expect(playableView({ ...base, content: { type: "true_false", statement: "Vrai.", answer: true } }, "CM1")).toEqual({ ...base, type: "true_false", statement: "Vrai." });
    expect(playableView({ ...base, content: { type: "mental_math", question: "4 × 7", answer: 28 } }, "CM1")).toEqual({ ...base, type: "mental_math", question: "4 × 7" });
    expect(playableView({ ...base, content: { type: "cloze", text: "Le {{0}} et le {{1}}.", blanks: ["verbe", "sujet"] } }, "CM1")).toEqual({ ...base, type: "cloze", text: "Le {{0}} et le {{1}}.", blankCount: 2 });
  });

  it("shows the word of a flash dictation, with its grade's duration", () => {
    expect(playableView({ ...base, content: { type: "delayed_copy", wordOrPhrase: "chanter" } }, "CP")).toEqual({ ...base, type: "delayed_copy", wordOrPhrase: "chanter", displayDurationMs: 5000 });
  });

  it("mixes the elements to reorder, never in the right order, the same way every time", () => {
    for (const id of ["a", "b", "c", "d", "e", "f", "g", "h"]) {
      for (const elements of [["1", "2"], ["1", "2", "3"], ["1", "2", "3", "4", "5", "6"]]) {
        const view = playableView({ id, itemTitle: "x", content: { type: "reordering", elements } }, "CM1");
        if (view.type !== "reordering") throw new Error(view.type);
        expect([...view.elements].sort()).toEqual(elements);
        expect(view.elements).not.toEqual(elements);
        expect(playableView({ id, itemTitle: "x", content: { type: "reordering", elements } }, "CM1")).toEqual(view);
      }
    }
  });

  it("mixes the right column of a matching, never facing its own left", () => {
    const pairs = [
      { left: "Hier", right: "chantait" },
      { left: "Aujourd'hui", right: "chante" },
      { left: "Demain", right: "chantera" },
    ];
    for (const id of ["a", "b", "c", "d", "e", "f"]) {
      const view = playableView({ id, itemTitle: "x", content: { type: "matching", pairs } }, "CM1");
      if (view.type !== "matching") throw new Error(view.type);
      expect(view.lefts).toEqual(["Hier", "Aujourd'hui", "Demain"]);
      expect([...view.rights].sort()).toEqual(["chantait", "chante", "chantera"]);
      view.rights.forEach((right, i) => expect(right).not.toBe(pairs[i]?.right));
    }
  });

  it("does not always put the right option of a question first", () => {
    const firsts = new Set(
      ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"].map((id) => {
        const view = playableView({ id, itemTitle: "x", content: { type: "mcq", question: "?", options: ["ok", "b", "c", "d"], answer: "ok" } }, "CM1");
        return view.type === "mcq" ? view.options[0] : "";
      }),
    );
    expect(firsts.size).toBeGreaterThan(1);
  });
});

describe("nextExercise", () => {
  const at = (minute: number) => `2026-09-26T10:${String(minute).padStart(2, "0")}:00.000Z`;
  const attempt = (exerciseId: string, minute: number, correct: boolean, starEligible = true) => ({ exerciseId, attemptedAt: at(minute), correct, starEligible });

  it("is the first exercise, in the course's order, never succeeded yet", () => {
    expect(nextExercise(["e1", "e2", "e3"], [])).toBe("e1");
    expect(nextExercise(["e1", "e2", "e3"], [attempt("e1", 1, true)])).toBe("e2");
    expect(nextExercise(["e1", "e2", "e3"], [attempt("e1", 1, true), attempt("e2", 2, false)])).toBe("e2");
  });

  it("a success needs every unit of one submission right and eligible; a reread does not count", () => {
    const halfRight = [attempt("e1", 1, true), attempt("e1", 1, false)];
    expect(nextExercise(["e1", "e2"], halfRight)).toBe("e1");
    expect(nextExercise(["e1", "e2"], [attempt("e1", 1, false), attempt("e1", 1, true)])).toBe("e1");
    expect(nextExercise(["e1", "e2"], [attempt("e1", 1, true, false)])).toBe("e1");
    expect(nextExercise(["e1", "e2"], [...halfRight, attempt("e1", 2, true), attempt("e1", 2, true)])).toBe("e2");
  });

  it("loops back to the first exercise once all are succeeded; none without exercise", () => {
    expect(nextExercise(["e1", "e2"], [attempt("e2", 1, true), attempt("e1", 2, true)])).toBe("e1");
    expect(nextExercise([], [])).toBeNull();
  });
});
