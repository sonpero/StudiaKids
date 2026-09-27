import type { Grade } from "../../auth/index.js";
import type { Result } from "../../shared/index.js";
import type { Classification, ClassificationError } from "./decision.js";
import type { Section } from "./split-into-sections.js";
import type { Conversation, Message } from "./types.js";

export type CourseForTutor = { title: string; subject: string; grade: Grade; markdown: string };

// docs/modules/tutor.md, Ports. Called before any other model call; a
// light generateObject, never a stream.
export interface QuestionClassifier {
  classify(input: { question: string; course: CourseForTutor }): Promise<Result<Classification, ClassificationError>>;
}

export interface ChatModel {
  stream(input: { question: string; sections: Section[]; history: { role: "user" | "assistant"; content: string }[]; grade: Grade }): AsyncIterable<string>;
}

export type ExtractError = { kind: "invalid-output"; message: string };

export interface CitationExtractor {
  extract(input: { answer: string; sections: Section[] }): Promise<Result<{ sectionIndexes: number[] }, ExtractError>>;
}

// Every method is scoped by userId (CLAUDE.md, rule 1).
export interface ConversationRepository {
  create(userId: string, conversation: Conversation): Promise<void>;
  find(userId: string, conversationId: string): Promise<Conversation | null>;
  latestForCourse(userId: string, courseId: string): Promise<Conversation | null>;
  listForCourse(userId: string, courseId: string): Promise<Conversation[]>;
  listMessages(userId: string, conversationId: string): Promise<Message[]>;
  // One short write transaction; the title is set only while still null.
  appendExchange(userId: string, conversationId: string, messages: Message[], title: string): Promise<void>;
  // When each of the account's questions was asked, from `since` on.
  questionTimesSince(userId: string, since: string): Promise<string[]>;
  delete(userId: string, conversationId: string): Promise<boolean>;
  // True only the first time for this account, whatever became of its
  // conversations since (docs/modules/tutor.md, tutor_disclosures).
  markDisclosed(userId: string, now: Date): Promise<boolean>;
  listForAccount(userId: string): Promise<{ conversation: Conversation; messages: Message[] }[]>;
}

// A course the tutor may talk about: the account's, confirmed and read.
export interface TutorCourseSource {
  read(userId: string, courseId: string): Promise<Result<CourseForTutor, "not-found" | "not-ready">>;
}
