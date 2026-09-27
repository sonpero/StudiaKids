import {
  conversationDetailSchema,
  startConversationResponseSchema,
  TUTOR_TERMINAL_EVENTS,
  tutorChunkSchema,
  tutorTerminalSchema,
  type ConversationDetailDto,
  type StartConversationResponse,
  type TutorMessageDto,
  type TutorTerminalEvent,
} from "@studiakids/contracts";
import { HttpError } from "./http-error.js";

export type TutorOutcome = { event: TutorTerminalEvent; message: TutorMessageDto };

// docs/modules/tutor.md, API. A 404 is a course (or conversation) gone
// meanwhile: null; anything else unexpected is the error state.
export async function openTutor(courseId: string): Promise<StartConversationResponse | null> {
  const res = await fetch(`/api/courses/${courseId}/conversations`, { method: "POST" });
  if (res.status === 404) return null;
  if (!res.ok) throw new HttpError(res.status, "POST /api/courses/:id/conversations");
  return startConversationResponseSchema.parse(await res.json());
}

export async function getConversation(conversationId: string): Promise<ConversationDetailDto | null> {
  const res = await fetch(`/api/conversations/${conversationId}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new HttpError(res.status, "GET /api/conversations/:id");
  return conversationDetailSchema.parse(await res.json());
}

const isTerminal = (name: string): name is TutorTerminalEvent => (TUTOR_TERMINAL_EVENTS as readonly string[]).includes(name);

// Reads the SSE answer as it arrives: each chunk to `onChunk`, then the one
// terminal event. A stream that ends without one throws — never a silent,
// half-shown answer.
export async function askTutor(conversationId: string, question: string, onChunk: (text: string) => void): Promise<TutorOutcome> {
  const res = await fetch(`/api/conversations/${conversationId}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question }) });
  if (!res.ok || !res.body) throw new HttpError(res.status, "POST /api/conversations/:id/messages");
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += value;
    let end = buffer.indexOf("\n\n");
    while (end >= 0) {
      const block = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      const name = /^event: (.*)$/m.exec(block)?.[1] ?? "";
      const data: unknown = JSON.parse(/^data: (.*)$/m.exec(block)?.[1] ?? "null");
      if (name === "chunk") onChunk(tutorChunkSchema.parse(data).text);
      else if (isTerminal(name)) return { event: name, message: tutorTerminalSchema.parse(data).message };
      end = buffer.indexOf("\n\n");
    }
  }
  throw new Error("the tutor's answer ended without its outcome");
}
