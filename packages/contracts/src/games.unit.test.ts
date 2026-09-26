import { describe, expect, it } from "vitest";
import { exerciseContentSchema, exerciseSchema, GAME_TYPES, gameTypeSchema, generationStatusSchema, itemSchema, readerTextSchema } from "./games.js";

// docs/modules/game-engine.md: the closed list of seven game types, and
// the content of an exercise per type.
describe("game types", () => {
  it("are the seven of the spec, in its order", () => {
    expect(GAME_TYPES).toEqual(["delayed_copy", "mcq", "matching", "reordering", "cloze", "true_false", "mental_math"]);
  });

  it("refuse anything else", () => {
    expect(gameTypeSchema.safeParse("quiz").success).toBe(false);
  });
});

describe("exercise content", () => {
  const valid = [
    { type: "delayed_copy", wordOrPhrase: "chanter" },
    { type: "mcq", question: "Qui chante ?", options: ["Léa", "Tom", "Max", "Zoé"], answer: "Léa" },
    { type: "matching", pairs: [{ left: "a", right: "b" }] },
    { type: "reordering", elements: ["hier", "aujourd'hui", "demain"] },
    { type: "cloze", text: "Le {{0}} change.", blanks: ["verbe"] },
    { type: "true_false", statement: "Le verbe change.", answer: true },
    { type: "mental_math", question: "8 000 + 300", answer: 8300 },
  ];

  it("parses one content per type", () => {
    for (const content of valid) expect(exerciseContentSchema.safeParse(content).success).toBe(true);
  });

  it("refuses a content whose fields do not match its type", () => {
    expect(exerciseContentSchema.safeParse({ type: "mcq", statement: "x", answer: true }).success).toBe(false);
    expect(exerciseContentSchema.safeParse({ type: "mental_math", question: "1 + 1", answer: "2" }).success).toBe(false);
  });
});

describe("DTOs", () => {
  it("an item carries its applicable game types, an exercise its content", () => {
    expect(itemSchema.safeParse({ id: "i1", title: "Le verbe", body: "…", gameTypes: ["mcq"], position: 0 }).success).toBe(true);
    expect(exerciseSchema.safeParse({ id: "e1", itemId: "i1", type: "true_false", content: { type: "true_false", statement: "s", answer: false } }).success).toBe(true);
  });

  it("the generation status counts game types, with the item count", () => {
    for (const status of ["not_started", "splitting", "insufficient_coverage", "generating", "ready", "failed"]) {
      expect(generationStatusSchema.safeParse({ status, done: 0, total: 0, failed: 0, itemCount: 0 }).success).toBe(true);
    }
    expect(generationStatusSchema.safeParse({ status: "items_ready", done: 0, total: 0, failed: 0, itemCount: 0 }).success).toBe(false);
  });

  it("the reader gets the Markdown, the text to speak and the photos", () => {
    expect(readerTextSchema.safeParse({ markdown: "# A", speech: "A", photos: [{ index: 0 }] }).success).toBe(true);
  });
});
