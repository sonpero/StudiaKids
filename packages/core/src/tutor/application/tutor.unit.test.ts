import { describe, expect, it } from "vitest";
import { DISTRESS_TEXT, fixedText } from "../domain/fixed-texts.js";
import { TUTOR_DAILY_LIMIT } from "../domain/decision.js";
import type { Classification, ClassificationError } from "../domain/decision.js";
import type { ExtractError } from "../domain/ports.js";
import type { Message } from "../domain/types.js";
import { ask, type AskEvent } from "./ask.js";
import { fakeChat, fakeCitations, fakeClassifier, fakeConversationRepository, fakeCourses, sequentialIds } from "./fakes.js";
import { deleteConversation, getConversation, openConversation } from "./conversations.js";

const now = new Date("2026-09-27T10:00:00.000Z");
const onTopic: Classification = { onTopic: true, sensitive: false, distress: false };

function setup(classification: Classification | ClassificationError | "throws" = onTopic, chat = fakeChat(["Un verbe, ", "c'est une action."]), citations: number[] | ExtractError = [0]) {
  const deps = {
    repo: fakeConversationRepository(),
    courses: fakeCourses({ verbe: { userId: "lea" }, other: { userId: "lea" }, "not-read": { userId: "lea", ready: false }, "toms-course": { userId: "tom" } }),
    classifier: fakeClassifier(classification),
    chat,
    citations: fakeCitations(citations),
    idGenerator: sequentialIds(),
  };
  return deps;
}
type Deps = ReturnType<typeof setup>;

async function open(deps: Deps, userId = "lea", courseId = "verbe") {
  const opened = await openConversation(deps, userId, courseId, now);
  if (!opened.ok) throw new Error(opened.error);
  return opened.value;
}

async function askAll(deps: Deps, question: string, conversationId: string, userId = "lea", at = now): Promise<AskEvent[]> {
  const session = await ask(deps, { userId, conversationId, question }, at);
  if (!session.ok) throw new Error(session.error);
  const events: AskEvent[] = [];
  for await (const event of session.value) events.push(event);
  return events;
}
const terminal = (events: AskEvent[]) => events.at(-1);
const assistantOf = (deps: Deps): Message[] => deps.repo.messages.filter((m) => m.role === "assistant");

describe("ask: the decision is taken before any answer model is called", () => {
  const cases: [string, Classification | ClassificationError | "throws", string, Partial<Message>][] = [
    ["distress", { onTopic: true, sensitive: false, distress: true }, "distress", { issue: "distress", outOfBand: true, content: DISTRESS_TEXT }],
    ["sensitive", { onTopic: true, sensitive: true, distress: false }, "refusal", { issue: "sensitive", outOfBand: false, content: fixedText("sensitive") }],
    ["off topic", { onTopic: false, sensitive: false, distress: false }, "refusal", { issue: "off_topic", outOfBand: false, content: fixedText("off_topic") }],
    ["a classifier error", { kind: "model-error", message: "timeout" }, "unavailable", { issue: "unavailable", content: fixedText("unavailable") }],
    ["an unreadable classification", { kind: "invalid-output", message: "x" }, "unavailable", { issue: "unavailable", content: fixedText("unavailable") }],
    ["a classifier that throws", "throws", "unavailable", { issue: "unavailable", content: fixedText("unavailable") }],
  ];
  for (const [name, classification, event, stored] of cases) {
    it(`${name}: never the answer model, a fixed text, the exchange kept`, async () => {
      const deps = setup(classification);
      const { conversation } = await open(deps);

      const events = await askAll(deps, "ma question", conversation.id);

      expect(deps.chat.calls).toHaveLength(0);
      expect(deps.citations.calls).toBe(0);
      expect(events).toHaveLength(1);
      expect(terminal(events)).toMatchObject({ type: event, message: { role: "assistant", citations: null, partial: false, ...stored } });
      expect(deps.repo.messages.map((m) => [m.role, m.content])).toEqual([
        ["user", "ma question"],
        ["assistant", stored.content],
      ]);
    });
  }

  it("sensitive and distress at once is distress, never a refusal", async () => {
    const deps = setup({ onTopic: false, sensitive: true, distress: true });
    const { conversation } = await open(deps);

    expect(terminal(await askAll(deps, "?", conversation.id))).toMatchObject({ type: "distress", message: { issue: "distress", outOfBand: true } });
  });
});

describe("ask: a complete answer", () => {
  it("streams the text, then done with the cited sections' text, and stores both messages", async () => {
    const deps = setup(onTopic, fakeChat(["Un verbe, ", "c'est une action."]), [1, 0, 1]);
    const { conversation } = await open(deps);

    const events = await askAll(deps, "c koi un verbe", conversation.id);

    expect(events.slice(0, -1)).toEqual([
      { type: "chunk", text: "Un verbe, " },
      { type: "chunk", text: "c'est une action." },
    ]);
    const done = terminal(events);
    expect(done?.type).toBe("done");
    const citations = done && "message" in done ? done.message.citations : null;
    expect(citations?.map((c) => c.text.slice(0, 9))).toEqual(["# Le verb", "## L'infi"]);
    expect(assistantOf(deps)).toMatchObject([{ content: "Un verbe, c'est une action.", issue: null, partial: false, outOfBand: false }]);
    expect(deps.repo.conversations[0]?.title).toBe("c koi un verbe");
    expect(deps.chat.calls[0]).toMatchObject({ question: "c koi un verbe", grade: "CE2", history: [] });
  });

  it("citations that cannot be read leave the answer whole, with no citation", async () => {
    const deps = setup(onTopic, undefined, { kind: "invalid-output", message: "x" });
    const { conversation } = await open(deps);

    expect(terminal(await askAll(deps, "q", conversation.id))).toMatchObject({ type: "done", message: { content: "Un verbe, c'est une action.", citations: [] } });
  });

  it("gives the model only the complete exchanges of this conversation", async () => {
    const deps = setup();
    const { conversation } = await open(deps);
    await askAll(deps, "q1", conversation.id);
    deps.classifier.classify = () => Promise.resolve({ ok: true, value: { onTopic: false, sensitive: false, distress: false } });
    await askAll(deps, "hors sujet", conversation.id);
    deps.classifier.classify = () => Promise.resolve({ ok: true, value: onTopic });

    await askAll(deps, "q3", conversation.id);

    expect(deps.chat.calls[1]?.history).toEqual([
      { role: "user", content: "q1" },
      { role: "assistant", content: "Un verbe, c'est une action." },
    ]);
  });

  it("the title is the first question's, kept afterwards", async () => {
    const deps = setup();
    const { conversation } = await open(deps);
    await askAll(deps, "première", conversation.id);
    await askAll(deps, "seconde", conversation.id);
    expect(deps.repo.conversations[0]?.title).toBe("première");
  });
});

describe("ask: an interrupted answer", () => {
  it("is partial: the text given so far, no citation, never the extractor", async () => {
    const deps = setup(onTopic, fakeChat(["Un verbe, "], true));
    const { conversation } = await open(deps);

    const events = await askAll(deps, "q", conversation.id);

    expect(events[0]).toEqual({ type: "chunk", text: "Un verbe, " });
    expect(terminal(events)).toMatchObject({ type: "partial", message: { content: "Un verbe, ", partial: true, citations: null, issue: null } });
    expect(deps.citations.calls).toBe(0);
  });

  it("with no text at all, it is the fixed « ask again » message", async () => {
    const deps = setup(onTopic, fakeChat([], true));
    const { conversation } = await open(deps);

    expect(terminal(await askAll(deps, "q", conversation.id))).toMatchObject({ type: "unavailable", message: { issue: "unavailable", content: fixedText("unavailable") } });
  });
});

describe("ask: the daily cap (40 questions a Paris day)", () => {
  async function withQuestionsAsked(deps: Deps, conversationId: string, count: number, at: Date) {
    for (let i = 0; i < count; i++) await askAll(deps, `q${String(i)}`, conversationId, "lea", at);
    deps.chat.calls.length = 0;
  }

  it("the 41st question of the day is the fixed « tomorrow » message, without the answer model", async () => {
    const deps = setup();
    const { conversation } = await open(deps);
    await withQuestionsAsked(deps, conversation.id, TUTOR_DAILY_LIMIT, now);

    const events = await askAll(deps, "encore", conversation.id);

    expect(terminal(events)).toMatchObject({ type: "daily_limit", message: { issue: "daily_limit", content: fixedText("daily_limit") } });
    expect(deps.chat.calls).toHaveLength(0);
  });

  it("the 40th is still answered", async () => {
    const deps = setup();
    const { conversation } = await open(deps);
    await withQuestionsAsked(deps, conversation.id, TUTOR_DAILY_LIMIT - 1, now);

    expect(terminal(await askAll(deps, "encore", conversation.id))?.type).toBe("done");
  });

  it("distress is never capped: the classifier is still asked", async () => {
    const deps = setup();
    const { conversation } = await open(deps);
    await withQuestionsAsked(deps, conversation.id, TUTOR_DAILY_LIMIT, now);
    deps.classifier.classify = () => Promise.resolve({ ok: true, value: { onTopic: false, sensitive: false, distress: true } });

    expect(terminal(await askAll(deps, "on me tape", conversation.id))?.type).toBe("distress");
  });

  it("yesterday's questions (Paris) do not count: 23:59 then 00:00, summer time", async () => {
    const deps = setup();
    const { conversation } = await open(deps);
    await withQuestionsAsked(deps, conversation.id, TUTOR_DAILY_LIMIT, new Date("2026-09-26T21:59:00.000Z"));

    expect(terminal(await askAll(deps, "encore", conversation.id, "lea", new Date("2026-09-26T22:00:00.000Z")))?.type).toBe("done");
  });

  it("counts the whole Paris day: questions from 00:30 still count at 23:30", async () => {
    const deps = setup();
    const { conversation } = await open(deps);
    await withQuestionsAsked(deps, conversation.id, TUTOR_DAILY_LIMIT, new Date("2026-09-26T22:30:00.000Z"));

    expect(terminal(await askAll(deps, "encore", conversation.id, "lea", new Date("2026-09-27T21:30:00.000Z")))?.type).toBe("daily_limit");
  });

  it("counts the account's questions in every conversation, but never another account's", async () => {
    const deps = setup();
    const first = await open(deps);
    await withQuestionsAsked(deps, first.conversation.id, TUTOR_DAILY_LIMIT, now);
    const second = await open(deps, "lea", "other");
    const tom = await open(deps, "tom", "toms-course");

    expect(terminal(await askAll(deps, "q", second.conversation.id))?.type).toBe("daily_limit");
    expect(terminal(await askAll(deps, "q", tom.conversation.id, "tom"))?.type).toBe("done");
  });
});

describe("ask: scoped to the account", () => {
  it("another account's conversation is not found, and nothing is read from its course", async () => {
    const deps = setup();
    const { conversation } = await open(deps);
    deps.courses.reads.length = 0;

    expect(await ask(deps, { userId: "tom", conversationId: conversation.id, question: "q" }, now)).toEqual({ ok: false, error: "not-found" });
    expect(deps.courses.reads).toEqual([]);
    expect(deps.classifier.calls).toBe(0);
  });

  it("an unknown conversation is not found", async () => {
    expect(await ask(setup(), { userId: "lea", conversationId: "nope", question: "q" }, now)).toEqual({ ok: false, error: "not-found" });
  });
});

describe("openConversation", () => {
  it("resumes the course's last conversation, else creates one", async () => {
    const deps = setup();
    const first = await open(deps);
    const again = await open(deps);

    expect(again.conversation.id).toBe(first.conversation.id);
    expect(first.conversation).toMatchObject({ courseId: "verbe", title: null, createdAt: now.toISOString() });
    expect(deps.repo.conversations).toHaveLength(1);
  });

  it("the disclosure shows the first time only, even after that conversation is deleted", async () => {
    const deps = setup();
    const first = await open(deps);
    expect(first.showDisclosure).toBe(true);
    expect((await open(deps)).showDisclosure).toBe(false);

    expect(await deleteConversation(deps, "lea", first.conversation.id)).toEqual({ ok: true, value: undefined });
    const recreated = await open(deps);

    expect(recreated.conversation.id).not.toBe(first.conversation.id);
    expect(recreated.showDisclosure).toBe(false);
  });

  it("each account is told once", async () => {
    const deps = setup();
    await open(deps);
    expect((await open(deps, "tom", "toms-course")).showDisclosure).toBe(true);
  });

  it("refuses another account's course as unknown, and a course not read yet", async () => {
    const deps = setup();
    expect(await openConversation(deps, "tom", "verbe", now)).toEqual({ ok: false, error: "not-found" });
    expect(await openConversation(deps, "lea", "not-read", now)).toEqual({ ok: false, error: "not-ready" });
    expect(deps.repo.disclosed.size).toBe(0);
  });
});

describe("getConversation / deleteConversation", () => {
  it("another account's conversation is not found, and stays", async () => {
    const deps = setup();
    const { conversation } = await open(deps);

    expect(await getConversation(deps, "tom", conversation.id)).toEqual({ ok: false, error: "not-found" });
    expect(await deleteConversation(deps, "tom", conversation.id)).toEqual({ ok: false, error: "not-found" });
    expect(deps.repo.conversations).toHaveLength(1);
  });

  it("the history keeps a distress exchange, out of band", async () => {
    const deps = setup({ onTopic: true, sensitive: false, distress: true });
    const { conversation } = await open(deps);
    await askAll(deps, "on me tape", conversation.id);

    const detail = await getConversation(deps, "lea", conversation.id);

    expect(detail.ok && detail.value.messages.map((m) => [m.role, m.issue, m.outOfBand])).toEqual([
      ["user", null, false],
      ["assistant", "distress", true],
    ]);
  });
});
