// In-memory test doubles for the tutor's ports (CLAUDE.md rule 3).
import { err, ok, type Result } from "../../shared/index.js";
import type { Classification, ClassificationError } from "../domain/decision.js";
import type { ChatModel, CitationExtractor, ConversationRepository, CourseForTutor, ExtractError, QuestionClassifier, TutorCourseSource } from "../domain/ports.js";
import type { Conversation, Message } from "../domain/types.js";

export function fakeConversationRepository(): ConversationRepository & { conversations: Conversation[]; messages: Message[]; disclosed: Set<string> } {
  const conversations: Conversation[] = [];
  const messages: Message[] = [];
  const disclosed = new Set<string>();
  const owned = (userId: string, id: string) => conversations.find((c) => c.userId === userId && c.id === id) ?? null;
  return {
    conversations,
    messages,
    disclosed,
    create: (userId, conversation) => {
      conversations.push({ ...conversation, userId });
      return Promise.resolve();
    },
    find: (userId, id) => Promise.resolve(owned(userId, id)),
    latestForCourse: (userId, courseId) => Promise.resolve(conversations.filter((c) => c.userId === userId && c.courseId === courseId).at(-1) ?? null),
    listForCourse: (userId, courseId) => Promise.resolve(conversations.filter((c) => c.userId === userId && c.courseId === courseId)),
    listMessages: (userId, id) => Promise.resolve(owned(userId, id) ? messages.filter((m) => m.conversationId === id) : []),
    appendExchange: (userId, id, added, title) => {
      const conversation = owned(userId, id);
      if (!conversation) return Promise.reject(new Error("conversation not owned"));
      conversation.title ??= title;
      messages.push(...added);
      return Promise.resolve();
    },
    questionTimesSince: (userId, since) => {
      const ids = new Set(conversations.filter((c) => c.userId === userId).map((c) => c.id));
      return Promise.resolve(messages.filter((m) => ids.has(m.conversationId) && m.role === "user" && m.createdAt >= since).map((m) => m.createdAt));
    },
    delete: (userId, id) => {
      const i = conversations.findIndex((c) => c.userId === userId && c.id === id);
      if (i < 0) return Promise.resolve(false);
      conversations.splice(i, 1);
      for (let j = messages.length - 1; j >= 0; j--) if (messages[j]?.conversationId === id) messages.splice(j, 1);
      return Promise.resolve(true);
    },
    markDisclosed: (userId) => {
      const first = !disclosed.has(userId);
      disclosed.add(userId);
      return Promise.resolve(first);
    },
    listForAccount: (userId) => Promise.resolve(conversations.filter((c) => c.userId === userId).map((conversation) => ({ conversation, messages: messages.filter((m) => m.conversationId === conversation.id) }))),
  };
}

export const LESSON = "# Le verbe\n\nLe verbe indique ce que fait le sujet ou ce qu'il est, dans toutes les phrases de la leçon.\n\n## L'infinitif\n\nLe verbe a une forme qui ne change pas : l'infinitif, comme chanter, finir ou prendre.";

// courseId -> owner, and whether it can be read yet.
export function fakeCourses(courses: Record<string, { userId: string; ready?: boolean }>): TutorCourseSource & { reads: string[] } {
  const reads: string[] = [];
  return {
    reads,
    read: (userId, courseId): Promise<Result<CourseForTutor, "not-found" | "not-ready">> => {
      reads.push(`${userId}/${courseId}`);
      const course = courses[courseId];
      if (!course || course.userId !== userId) return Promise.resolve(err("not-found"));
      if (course.ready === false) return Promise.resolve(err("not-ready"));
      return Promise.resolve(ok({ title: "Le verbe", subject: "français", grade: "CE2", markdown: LESSON }));
    },
  };
}

export function fakeClassifier(answer: Classification | ClassificationError | "throws"): QuestionClassifier & { calls: number } {
  const classifier = {
    calls: 0,
    classify: (): Promise<Result<Classification, ClassificationError>> => {
      classifier.calls++;
      if (answer === "throws") return Promise.reject(new Error("boom"));
      return Promise.resolve("kind" in answer ? err(answer) : ok(answer));
    },
  };
  return classifier;
}

// chunks, then either the end or a failure after them.
export function fakeChat(chunks: string[], failsAfter = false): ChatModel & { calls: Parameters<ChatModel["stream"]>[0][] } {
  const calls: Parameters<ChatModel["stream"]>[0][] = [];
  return {
    calls,
    stream: (input) => {
      calls.push(input);
      return (async function* () {
        for (const chunk of chunks) {
          await Promise.resolve();
          yield chunk;
        }
        if (failsAfter) throw new Error("stream cut");
      })();
    },
  };
}

export function fakeCitations(answer: number[] | ExtractError): CitationExtractor & { calls: number } {
  const extractor = {
    calls: 0,
    extract: (): Promise<Result<{ sectionIndexes: number[] }, ExtractError>> => {
      extractor.calls++;
      return Promise.resolve(Array.isArray(answer) ? ok({ sectionIndexes: answer }) : err(answer));
    },
  };
  return extractor;
}

export const sequentialIds = (prefix = "id") => {
  let n = 0;
  return { next: () => `${prefix}-${String(++n).padStart(4, "0")}` };
};
