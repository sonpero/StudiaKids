import { streamText, type LanguageModel } from "ai";
import type { Grade } from "../../auth/index.js";
import type { ChatModel } from "../domain/ports.js";
import type { Section } from "../domain/split-into-sections.js";
import { answerSystemPrompt } from "./prompts.js";

// Answers are a few sentences for a child: a tight ceiling. The model
// factory rewrites max_tokens on every request, so the ceiling is its
// `maxTokens` when this model is built (createLanguageModel), never a
// streamText option, which would be silently overwritten.
export const ANSWER_MAX_TOKENS = 600;

// Checked by pnpm eval:tutor against docs/securite.md's rules on generated
// text, and replayed on a recorded stream by the contract tests.
export class ClaudeChatModel implements ChatModel {
  constructor(private readonly model: LanguageModel) {}

  stream(input: { question: string; sections: Section[]; history: { role: "user" | "assistant"; content: string }[]; grade: Grade }): AsyncIterable<string> {
    const { fullStream } = streamText({
      model: this.model,
      // The child is waiting: a failed request is told at once (and can be
      // asked again), never retried behind a silent screen.
      maxRetries: 0,
      system: answerSystemPrompt(input.grade, input.sections),
      messages: [...input.history, { role: "user" as const, content: input.question }],
    });
    return textOf(fullStream);
  }
}

// ai 4.x hands a stream's errors to onError and just ends textStream: an
// interrupted answer would pass for a complete one. Throws instead, after
// the text already given; an answer cut by the ceiling is not complete
// either.
async function* textOf(parts: AsyncIterable<{ type: string; textDelta?: string; error?: unknown; finishReason?: string }>): AsyncGenerator<string> {
  for await (const part of parts) {
    if (part.type === "text-delta" && part.textDelta) yield part.textDelta;
    if (part.type === "error") throw part.error instanceof Error ? part.error : new Error("answer stream failed");
    if (part.type === "finish" && part.finishReason !== "stop") throw new Error(`answer ended with ${String(part.finishReason)}`);
  }
}
