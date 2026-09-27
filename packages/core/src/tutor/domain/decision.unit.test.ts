import { describe, expect, it } from "vitest";
import { err, ok } from "../../shared/index.js";
import { decide, isLimitReached, questionsToday, TUTOR_DAILY_LIMIT } from "./decision.js";

// docs/modules/tutor.md and docs/securite.md (M6): what happens to a
// question, decided before any answer model is ever called.
const clear = { onTopic: true, sensitive: false, distress: false };
const flags = (partial: Partial<typeof clear>) => ok({ ...clear, ...partial });
const base = { prefilterDistress: false, limitReached: false };

describe("decide: distress first, then sensitive, then off-topic", () => {
  it("a question on the course, with room left today, is answered", () => {
    expect(decide({ ...base, classification: flags({}) })).toEqual({ kind: "answer" });
  });

  it("distress wins over everything: sensitive, off-topic, both", () => {
    for (const partial of [{ distress: true }, { distress: true, sensitive: true }, { distress: true, onTopic: false }, { distress: true, sensitive: true, onTopic: false }]) {
      expect(decide({ ...base, classification: flags(partial) }), JSON.stringify(partial)).toEqual({ kind: "distress" });
    }
  });

  it("sensitive wins over off-topic", () => {
    expect(decide({ ...base, classification: flags({ sensitive: true }) })).toEqual({ kind: "refusal", reason: "sensitive" });
    expect(decide({ ...base, classification: flags({ sensitive: true, onTopic: false }) })).toEqual({ kind: "refusal", reason: "sensitive" });
  });

  it("off-topic alone is an off-topic refusal", () => {
    expect(decide({ ...base, classification: flags({ onTopic: false }) })).toEqual({ kind: "refusal", reason: "off_topic" });
  });
});

describe("decide: a failed classifier never reaches the answer model", () => {
  it("any failure is the fixed « ask again » message — never an answer, whatever else", () => {
    for (const failure of [err({ kind: "model-error" as const, message: "timeout" }), err({ kind: "invalid-output" as const, message: "schema" })]) {
      expect(decide({ ...base, classification: failure })).toEqual({ kind: "unavailable" });
      expect(decide({ prefilterDistress: false, limitReached: true, classification: failure })).toEqual({ kind: "unavailable" });
    }
  });

  it("the lexical pre-filter, when it sees distress, shows the distress block even when the classifier failed or saw nothing", () => {
    expect(decide({ prefilterDistress: true, limitReached: false, classification: err({ kind: "model-error" as const, message: "timeout" }) })).toEqual({ kind: "distress" });
    expect(decide({ prefilterDistress: true, limitReached: true, classification: flags({}) })).toEqual({ kind: "distress" });
  });
});

describe("decide: the daily cap, never for distress", () => {
  it("over the cap, a question on the course gets the fixed « see you tomorrow » message", () => {
    expect(decide({ prefilterDistress: false, limitReached: true, classification: flags({}) })).toEqual({ kind: "daily_limit" });
  });

  it("over the cap, distress still shows the distress block", () => {
    expect(decide({ prefilterDistress: false, limitReached: true, classification: flags({ distress: true }) })).toEqual({ kind: "distress" });
    expect(decide({ prefilterDistress: false, limitReached: true, classification: flags({ distress: true, sensitive: true, onTopic: false }) })).toEqual({ kind: "distress" });
  });

  it("over the cap, a refusal stays a refusal (no answer either way)", () => {
    expect(decide({ prefilterDistress: false, limitReached: true, classification: flags({ sensitive: true }) })).toEqual({ kind: "refusal", reason: "sensitive" });
    expect(decide({ prefilterDistress: false, limitReached: true, classification: flags({ onTopic: false }) })).toEqual({ kind: "refusal", reason: "off_topic" });
  });
});

describe("the daily cap: 40 questions a Paris calendar day", () => {
  const now = new Date("2026-01-15T22:30:00.000Z"); // 23:30 in Paris, 15 January

  it("counts the account's questions of today in Paris, not of the UTC day", () => {
    const times = [
      "2026-01-14T22:59:00.000Z", // 23:59 on the 14th in Paris: yesterday
      "2026-01-14T23:00:00.000Z", // 00:00 on the 15th in Paris: today
      "2026-01-15T12:00:00.000Z",
      "2026-01-15T22:29:00.000Z",
    ];
    expect(questionsToday(times, now)).toBe(3);
  });

  it("is reached at the 40th question of the day, not before", () => {
    expect(TUTOR_DAILY_LIMIT).toBe(40);
    expect(isLimitReached(39)).toBe(false);
    expect(isLimitReached(40)).toBe(true);
  });

  it("starts again at midnight in Paris, summer time included", () => {
    const summer = new Date("2026-07-01T22:00:00.000Z"); // 00:00 on 2 July in Paris
    expect(questionsToday(Array.from({ length: 40 }, () => "2026-07-01T21:59:00.000Z"), summer)).toBe(0);
    expect(questionsToday(Array.from({ length: 40 }, () => "2026-07-01T22:00:00.000Z"), summer)).toBe(40);
  });
});
