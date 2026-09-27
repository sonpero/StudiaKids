import { describe, expect, it } from "vitest";
import {
  askRequestSchema,
  conversationDetailSchema,
  QUESTION_MAX_LENGTH,
  startConversationResponseSchema,
  TUTOR_ISSUES,
  TUTOR_TERMINAL_EVENTS,
  tutorChunkSchema,
  tutorMessageSchema,
  tutorTerminalSchema,
} from "./tutor.js";

// docs/modules/tutor.md (M6): the tutor's HTTP and SSE contract.
describe("tutor contract", () => {
  const conversation = { id: "c1", courseId: "k1", title: null, createdAt: "2026-09-27T10:00:00.000Z" };
  const answer = { id: "m2", role: "assistant", content: "Le verbe dit ce que fait le sujet.", citations: [{ text: "Le verbe indique…" }], issue: null, outOfBand: false, partial: false, createdAt: "2026-09-27T10:00:01.000Z" };

  it("starting a conversation says whether to show the disclosure", () => {
    expect(startConversationResponseSchema.parse({ conversation, showDisclosure: true })).toEqual({ conversation, showDisclosure: true });
  });

  it("a message says who speaks, its citations, its fixed issue, whether it is out of band or partial", () => {
    expect(tutorMessageSchema.parse(answer)).toEqual(answer);
    const distress = { ...answer, citations: null, issue: "distress", outOfBand: true };
    expect(tutorMessageSchema.parse(distress)).toEqual(distress);
    expect(TUTOR_ISSUES).toEqual(["off_topic", "sensitive", "distress", "unavailable", "daily_limit"]);
    expect(tutorMessageSchema.safeParse({ ...answer, issue: "angry" }).success).toBe(false);
    expect(conversationDetailSchema.parse({ conversation, messages: [answer] })).toEqual({ conversation, messages: [answer] });
  });

  it("a question is some text, not too long (« à valider »)", () => {
    expect(QUESTION_MAX_LENGTH).toBe(500);
    expect(askRequestSchema.safeParse({ question: "C'est quoi un verbe ?" }).success).toBe(true);
    expect(askRequestSchema.safeParse({ question: "   " }).success).toBe(false);
    expect(askRequestSchema.safeParse({ question: "a".repeat(501) }).success).toBe(false);
  });

  it("the stream: text chunks, then exactly one terminal event carrying the stored answer", () => {
    expect(TUTOR_TERMINAL_EVENTS).toEqual(["done", "partial", "refusal", "distress", "unavailable", "daily_limit"]);
    expect(tutorChunkSchema.parse({ text: "Le " })).toEqual({ text: "Le " });
    expect(tutorTerminalSchema.parse({ message: answer })).toEqual({ message: answer });
  });
});
