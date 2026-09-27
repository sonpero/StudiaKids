import { err, ok, type IdGenerator, type Result } from "../../shared/index.js";
import { decide, isLimitReached, questionsToday, type Classification, type ClassificationError, type Decision } from "../domain/decision.js";
import { fixedText, type FixedIssue } from "../domain/fixed-texts.js";
import { answerHistory } from "../domain/history.js";
import type { ChatModel, CitationExtractor, ConversationRepository, QuestionClassifier, TutorCourseSource } from "../domain/ports.js";
import { sectionsOf, type Section } from "../domain/split-into-sections.js";
import { truncateTitle } from "../domain/truncate-title.js";
import type { Citation, Message } from "../domain/types.js";

export interface AskDeps {
  repo: ConversationRepository;
  courses: TutorCourseSource;
  classifier: QuestionClassifier;
  chat: ChatModel;
  citations: CitationExtractor;
  idGenerator: IdGenerator;
}

export type AskTerminal = "done" | "partial" | "refusal" | "distress" | "unavailable" | "daily_limit";
export type AskEvent = { type: "chunk"; text: string } | { type: AskTerminal; message: Message };

// Enough to hold a whole Paris day, whatever the offset.
const DAY_WINDOW_MS = 48 * 60 * 60 * 1000;

const TERMINAL_OF: Record<FixedIssue, AskTerminal> = { off_topic: "refusal", sensitive: "refusal", distress: "distress", unavailable: "unavailable", daily_limit: "daily_limit" };

function issueOf(decision: Exclude<Decision, { kind: "answer" }>): FixedIssue {
  return decision.kind === "refusal" ? decision.reason : decision.kind;
}

// docs/modules/tutor.md, `ask`. Everything that decides is read and
// classified before a single word of answer exists; every model call is
// made outside any transaction; the exchange is written at the end in one
// short transaction (CLAUDE.md, rules 2 and 3).
export async function ask(deps: AskDeps, input: { userId: string; conversationId: string; question: string }, now: Date): Promise<Result<AsyncGenerator<AskEvent>, "not-found" | "not-ready">> {
  const { userId, conversationId, question } = input;
  const conversation = await deps.repo.find(userId, conversationId);
  if (!conversation) return err("not-found");
  const course = await deps.courses.read(userId, conversation.courseId);
  if (!course.ok) return err(course.error);

  const message = (role: Message["role"], content: string, extra: Partial<Message> = {}): Message => ({
    id: deps.idGenerator.next(),
    conversationId,
    role,
    content,
    citations: null,
    issue: null,
    outOfBand: false,
    partial: false,
    createdAt: now.toISOString(),
    ...extra,
  });
  const asked = message("user", question);
  const save = (answer: Message) => deps.repo.appendExchange(userId, conversationId, [asked, answer], truncateTitle(question));
  const fixed = async (issue: FixedIssue): Promise<AskEvent> => {
    const answer = message("assistant", fixedText(issue), { issue, outOfBand: issue === "distress" });
    await save(answer);
    return { type: TERMINAL_OF[issue], message: answer };
  };

  const since = new Date(now.getTime() - DAY_WINDOW_MS).toISOString();
  const limitReached = isLimitReached(questionsToday(await deps.repo.questionTimesSince(userId, since), now));
  const decision = decide({ prefilterDistress: false, limitReached, classification: await classifySafely(deps.classifier, question, course.value) });
  const history = decision.kind === "answer" ? answerHistory(await deps.repo.listMessages(userId, conversationId)) : [];

  return ok(
    (async function* (): AsyncGenerator<AskEvent> {
      if (decision.kind !== "answer") {
        yield await fixed(issueOf(decision));
        return;
      }
      const sections = sectionsOf(course.value.markdown);
      let text = "";
      try {
        for await (const chunk of deps.chat.stream({ question, sections, history, grade: course.value.grade })) {
          text += chunk;
          yield { type: "chunk", text: chunk };
        }
      } catch {
        // Nothing said yet: the child is simply asked to try again.
        if (text === "") {
          yield await fixed("unavailable");
          return;
        }
        const answer = message("assistant", text, { partial: true });
        await save(answer);
        yield { type: "partial", message: answer };
        return;
      }
      const answer = message("assistant", text, { citations: await citationsFor(deps.citations, text, sections) });
      await save(answer);
      yield { type: "done", message: answer };
    })(),
  );
}

// A classifier that throws is a failed classifier: never the answer model.
async function classifySafely(classifier: QuestionClassifier, question: string, course: Parameters<QuestionClassifier["classify"]>[0]["course"]): Promise<Result<Classification, ClassificationError>> {
  try {
    return await classifier.classify({ question, course });
  } catch (error) {
    return err({ kind: "model-error", message: error instanceof Error ? error.message : String(error) });
  }
}

// Only to show « look here in your lesson »: never a reason to hold back
// an answer already given (docs/modules/tutor.md).
async function citationsFor(extractor: CitationExtractor, answer: string, sections: Section[]): Promise<Citation[]> {
  try {
    const result = await extractor.extract({ answer, sections });
    if (!result.ok) return [];
    const indexes = [...new Set(result.value.sectionIndexes)].sort((a, b) => a - b);
    return indexes.flatMap((index) => {
      const section = sections.find((candidate) => candidate.index === index);
      return section ? [{ text: section.text }] : [];
    });
  } catch {
    return [];
  }
}
