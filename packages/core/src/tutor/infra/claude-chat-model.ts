import { streamText, type LanguageModel } from "ai";
import type { Grade } from "../../auth/index.js";
import type { ChatModel } from "../domain/ports.js";
import type { Section } from "../domain/split-into-sections.js";
import { answerSystemPrompt } from "./prompts.js";

// Answers are a few sentences for a child: a tight ceiling.
export const ANSWER_MAX_TOKENS = 600;

// Never called by pnpm test (CLAUDE.md rule 3): the real adapter, checked by
// pnpm eval against docs/securite.md's rules on generated text.
export class ClaudeChatModel implements ChatModel {
  constructor(private readonly model: LanguageModel) {}

  stream(input: { question: string; sections: Section[]; history: { role: "user" | "assistant"; content: string }[]; grade: Grade }): AsyncIterable<string> {
    const { textStream } = streamText({
      model: this.model,
      maxTokens: ANSWER_MAX_TOKENS,
      system: answerSystemPrompt(input.grade, input.sections),
      messages: [...input.history, { role: "user" as const, content: input.question }],
    });
    return textStream;
  }
}
