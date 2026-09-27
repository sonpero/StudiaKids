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
    const { textStream } = streamText({
      model: this.model,
      system: answerSystemPrompt(input.grade, input.sections),
      messages: [...input.history, { role: "user" as const, content: input.question }],
    });
    return textStream;
  }
}
