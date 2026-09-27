import type { Message } from "./types.js";

export type HistoryTurn = { role: "user" | "assistant"; content: string };

// docs/modules/tutor.md (M6): only a question followed by its complete
// answer — never an exchange that was refused, in distress, failed, capped
// or cut. What the model never saw it cannot bring back up.
export function answerHistory(messages: Message[]): HistoryTurn[] {
  const turns: HistoryTurn[] = [];
  messages.forEach((message, i) => {
    const question = messages[i - 1];
    if (message.role !== "assistant" || message.issue !== null || message.partial || question?.role !== "user") return;
    turns.push({ role: "user", content: question.content }, { role: "assistant", content: message.content });
  });
  return turns;
}
