import { describe, expect, it } from "vitest";
import { GAME_TYPES } from "./games.js";
import { answerRequestSchema, answerResponseSchema, GIVEN_ANSWER_SCHEMAS, playableExerciseSchema, playableListResponseSchema, playErrorSchema } from "./play.js";

// docs/modules/game-engine.md (M4): what the Jouer screen receives — never
// an answer — and what it sends back.
describe("given answers", () => {
  const valid = {
    delayed_copy: { text: "chanter" },
    mcq: { chosenOption: "Léa" },
    matching: { pairs: [{ left: "Hier", right: "Léa chantait" }] },
    reordering: { order: ["hier", "aujourd'hui"] },
    cloze: { values: ["verbe"] },
    true_false: { value: false },
    mental_math: { value: "13" },
  } as const;

  it("have one schema per game type", () => {
    expect(Object.keys(GIVEN_ANSWER_SCHEMAS).sort()).toEqual([...GAME_TYPES].sort());
    for (const type of GAME_TYPES) expect(GIVEN_ANSWER_SCHEMAS[type].safeParse(valid[type]).success, type).toBe(true);
  });

  it("refuse another type's shape", () => {
    expect(GIVEN_ANSWER_SCHEMAS.true_false.safeParse({ value: "vrai" }).success).toBe(false);
    expect(GIVEN_ANSWER_SCHEMAS.cloze.safeParse({ text: "verbe" }).success).toBe(false);
    expect(GIVEN_ANSWER_SCHEMAS.mental_math.safeParse({ value: 13 }).success).toBe(false);
  });

  it("the request carries the answer and the reread flag; the response only units", () => {
    expect(answerRequestSchema.parse({ givenAnswer: { text: "x" }, reread: true })).toEqual({ givenAnswer: { text: "x" }, reread: true });
    expect(answerResponseSchema.parse({ result: { units: [{ id: "0", correct: true }] } })).toEqual({ result: { units: [{ id: "0", correct: true }] } });
    expect(playErrorSchema.safeParse({ error: "invalid_answer" }).success).toBe(true);
  });
});

describe("playable exercises", () => {
  const base = { id: "e1", itemTitle: "Le verbe" };

  it("carry what the screen shows, per type", () => {
    const valid = [
      { ...base, type: "delayed_copy", wordOrPhrase: "chanter", displayDurationMs: 3000 },
      { ...base, type: "mcq", question: "Qui chante ?", options: ["Léa", "Tom", "Max", "Zoé"] },
      { ...base, type: "matching", lefts: ["a", "b", "c"], rights: ["y", "z", "x"] },
      { ...base, type: "reordering", elements: ["b", "a", "c"] },
      { ...base, type: "cloze", text: "Le {{0}} change.", blankCount: 1 },
      { ...base, type: "true_false", statement: "Le verbe change." },
      { ...base, type: "mental_math", question: "8 + 5" },
    ];
    for (const exercise of valid) expect(playableExerciseSchema.safeParse(exercise).success, exercise.type).toBe(true);
    expect(playableListResponseSchema.safeParse({ exercises: valid, nextExerciseId: "e1" }).success).toBe(true);
    expect(playableListResponseSchema.safeParse({ exercises: [], nextExerciseId: null }).success).toBe(true);
  });

  it("never carry an answer, whatever the server puts in", () => {
    const parsed = playableExerciseSchema.parse({ ...base, type: "mcq", question: "Qui ?", options: ["a", "b", "c", "d"], answer: "a" });
    expect(parsed).not.toHaveProperty("answer");
    const cloze = playableExerciseSchema.parse({ ...base, type: "cloze", text: "Le {{0}}.", blankCount: 1, blanks: ["verbe"] });
    expect(cloze).not.toHaveProperty("blanks");
  });
});

// M4 closing decision: after a wrong answer, the right one is shown
// briefly — sent only then, in the shape of a given answer.
describe("the correction", () => {
  it("rides along with a wrong answer's result, in the shape of a given answer", () => {
    const wrong = { result: { units: [{ id: "0", correct: false }] }, correction: { chosenOption: "chante" } };
    expect(answerResponseSchema.parse(wrong)).toEqual(wrong);
    const matching = { result: { units: [{ id: "0", correct: false }] }, correction: { pairs: [{ left: "Hier", right: "Léa chantait" }] } };
    expect(answerResponseSchema.parse(matching)).toEqual(matching);
  });

  it("is absent from a right answer's result", () => {
    expect(answerResponseSchema.parse({ result: { units: [{ id: "0", correct: true }] } })).toEqual({ result: { units: [{ id: "0", correct: true }] } });
  });
});
