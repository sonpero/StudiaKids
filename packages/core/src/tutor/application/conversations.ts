import { err, ok, type IdGenerator, type Result } from "../../shared/index.js";
import type { ConversationRepository, TutorCourseSource } from "../domain/ports.js";
import type { Conversation, Message } from "../domain/types.js";

export interface ConversationDeps {
  repo: ConversationRepository;
  courses: TutorCourseSource;
  idGenerator: IdGenerator;
}

// docs/modules/tutor.md (M6): opening the tutor on a course resumes its
// last conversation, else starts one. The disclosure is shown once per
// account, ever — the flag outlives any conversation.
export async function openConversation(
  deps: ConversationDeps,
  userId: string,
  courseId: string,
  now: Date,
): Promise<Result<{ conversation: Conversation; showDisclosure: boolean }, "not-found" | "not-ready">> {
  const course = await deps.courses.read(userId, courseId);
  if (!course.ok) return err(course.error);
  let conversation = await deps.repo.latestForCourse(userId, courseId);
  if (!conversation) {
    conversation = { id: deps.idGenerator.next(), userId, courseId, title: null, createdAt: now.toISOString() };
    await deps.repo.create(userId, conversation);
  }
  const showDisclosure = await deps.repo.markDisclosed(userId, now);
  return ok({ conversation, showDisclosure });
}

export async function getConversation(deps: Pick<ConversationDeps, "repo">, userId: string, conversationId: string): Promise<Result<{ conversation: Conversation; messages: Message[] }, "not-found">> {
  const conversation = await deps.repo.find(userId, conversationId);
  if (!conversation) return err("not-found");
  return ok({ conversation, messages: await deps.repo.listMessages(userId, conversationId) });
}

export async function listConversations(deps: Pick<ConversationDeps, "repo" | "courses">, userId: string, courseId: string): Promise<Result<Conversation[], "not-found" | "not-ready">> {
  const course = await deps.courses.read(userId, courseId);
  if (!course.ok) return err(course.error);
  return ok(await deps.repo.listForCourse(userId, courseId));
}

export async function deleteConversation(deps: Pick<ConversationDeps, "repo">, userId: string, conversationId: string): Promise<Result<void, "not-found">> {
  return (await deps.repo.delete(userId, conversationId)) ? ok(undefined) : err("not-found");
}

// pnpm tutor:history (docs/securite.md): everything, distress included.
export function exportTutorHistory(deps: Pick<ConversationDeps, "repo">, userId: string): Promise<{ conversation: Conversation; messages: Message[] }[]> {
  return deps.repo.listForAccount(userId);
}
