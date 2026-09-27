import { z } from "zod";

// docs/modules/tutor.md (M6). The fixed issues: a text never generated.
export const TUTOR_ISSUES = ["off_topic", "sensitive", "distress", "unavailable", "daily_limit"] as const;
export const tutorIssueSchema = z.enum(TUTOR_ISSUES);

export const conversationSchema = z.object({ id: z.string(), courseId: z.string(), title: z.string().nullable(), createdAt: z.string() });
export type ConversationDto = z.infer<typeof conversationSchema>;

export const tutorMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]).describe("user = l'enfant"),
  content: z.string(),
  citations: z.array(z.object({ text: z.string() })).nullable(),
  issue: tutorIssueSchema.nullable(),
  outOfBand: z.boolean().describe("Vrai seulement pour la détresse : jamais une bulle du fil"),
  partial: z.boolean(),
  createdAt: z.string(),
});
export type TutorMessageDto = z.infer<typeof tutorMessageSchema>;

export const startConversationResponseSchema = z.object({ conversation: conversationSchema, showDisclosure: z.boolean() });
export const conversationDetailSchema = z.object({ conversation: conversationSchema, messages: z.array(tutorMessageSchema) });
export const conversationListResponseSchema = z.object({ conversations: z.array(conversationSchema) });
export const conversationParamsSchema = z.object({ id: z.string() });

// « à valider »: long enough for a child's question, short enough to stay one.
export const QUESTION_MAX_LENGTH = 500;
export const askRequestSchema = z.object({
  question: z
    .string()
    .max(QUESTION_MAX_LENGTH)
    .refine((question) => question.trim() !== "", { message: "Une question vide" }),
});

// SSE: text chunks (a complete answer only), then one terminal event named
// after the outcome, carrying the stored assistant message.
export const TUTOR_TERMINAL_EVENTS = ["done", "partial", "refusal", "distress", "unavailable", "daily_limit"] as const;
export type TutorTerminalEvent = (typeof TUTOR_TERMINAL_EVENTS)[number];
export const tutorChunkSchema = z.object({ text: z.string() });
export const tutorTerminalSchema = z.object({ message: tutorMessageSchema });

export const tutorErrorSchema = z.object({ error: z.enum(["not_found", "not_ready", "invalid_question"]) });
