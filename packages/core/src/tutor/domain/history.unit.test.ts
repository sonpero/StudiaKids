import { describe, expect, it } from "vitest";
import { answerHistory } from "./history.js";
import type { Message } from "./types.js";

let n = 0;
const message = (role: "user" | "assistant", content: string, extra: Partial<Message> = {}): Message => ({
  id: String(n++),
  conversationId: "c",
  role,
  content,
  citations: role === "assistant" ? [] : null,
  issue: null,
  outOfBand: false,
  partial: false,
  createdAt: "2026-09-27T10:00:00.000Z",
  ...extra,
});

// docs/modules/tutor.md (M6): the answer model sees only the questions that
// got a complete answer, and those answers.
describe("answerHistory", () => {
  it("keeps complete exchanges, in order", () => {
    expect(answerHistory([message("user", "q1"), message("assistant", "r1"), message("user", "q2"), message("assistant", "r2")])).toEqual([
      { role: "user", content: "q1" },
      { role: "assistant", content: "r1" },
      { role: "user", content: "q2" },
      { role: "assistant", content: "r2" },
    ]);
  });

  it("never gives a refused, distress, failed or capped exchange, nor a partial answer", () => {
    const history = [
      message("user", "hors sujet"),
      message("assistant", "refus", { issue: "off_topic" }),
      message("user", "sensible"),
      message("assistant", "refus", { issue: "sensitive" }),
      message("user", "détresse"),
      message("assistant", "119", { issue: "distress", outOfBand: true }),
      message("user", "échec"),
      message("assistant", "oups", { issue: "unavailable" }),
      message("user", "plafond"),
      message("assistant", "demain", { issue: "daily_limit" }),
      message("user", "coupée"),
      message("assistant", "Un ver", { partial: true, citations: null }),
      message("user", "q"),
      message("assistant", "r"),
    ];
    expect(answerHistory(history)).toEqual([
      { role: "user", content: "q" },
      { role: "assistant", content: "r" },
    ]);
  });

  it("a question left without an answer is not given", () => {
    expect(answerHistory([message("user", "q1"), message("user", "q2"), message("assistant", "r2")])).toEqual([
      { role: "user", content: "q2" },
      { role: "assistant", content: "r2" },
    ]);
  });

  // Found by mutation testing (M6): pairs are read strictly.
  it("an answer right after another answer is not given as a question", () => {
    expect(answerHistory([message("user", "q1"), message("assistant", "r1"), message("assistant", "r2")])).toEqual([
      { role: "user", content: "q1" },
      { role: "assistant", content: "r1" },
    ]);
  });
});
