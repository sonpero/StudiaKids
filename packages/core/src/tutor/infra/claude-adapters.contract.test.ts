import { describe, expect, it } from "vitest";
import { FIXTURE_SOURCE, loadFixture, replayFetch } from "../../../../../tests/support/llm-fixtures.js";
import { createLanguageModel } from "../../shared/index.js";
import { decide } from "../domain/decision.js";
import { sectionsOf } from "../domain/split-into-sections.js";
import { ANSWER_MAX_TOKENS, ClaudeChatModel } from "./claude-chat-model.js";
import { ClaudeCitationExtractor } from "./claude-citation-extractor.js";
import { ClaudeQuestionClassifier } from "./claude-question-classifier.js";

// Contract tests: raw claude-sonnet-5 responses recorded on the text of
// ingestion's recorded page (tests/fixtures/tutor/, each file names its
// source and its question), replayed through the real adapters.
function lessonMarkdown(): string {
  const body = loadFixture("ingestion", "legible").exchanges.at(-1)?.body as { content: { type: string; input?: { markdown: string } }[] };
  const markdown = body.content.find((block) => block.type === "tool_use")?.input?.markdown;
  if (markdown === undefined) throw new Error("no markdown in ingestion/legible");
  return markdown;
}
const course = () => ({ title: "Le verbe", subject: "français", grade: "CE2" as const, markdown: lessonMarkdown() });
const questionOf = (fixtureCase: string) => (loadFixture("tutor", fixtureCase) as unknown as { question: string }).question;

async function classify(fixtureCase: string) {
  const replay = replayFetch(loadFixture("tutor", fixtureCase));
  const classifier = new ClaudeQuestionClassifier(createLanguageModel({ apiKey: "k", fetch: replay.fetch }));
  const result = await classifier.classify({ question: questionOf(fixtureCase), course: course() });
  return { result, requests: replay.requests, decision: decide({ prefilterDistress: false, limitReached: false, classification: result }) };
}

describe(`ClaudeQuestionClassifier contract (${FIXTURE_SOURCE} fixtures)`, () => {
  it("each recorded answer leads to the tutor's decision for its question, in one call", async () => {
    const expected = {
      "classify-on-topic": { kind: "answer" },
      "classify-off-topic": { kind: "refusal", reason: "off_topic" },
      "classify-sensitive": { kind: "refusal", reason: "sensitive" },
      "classify-distress": { kind: "distress" },
      "classify-mixed": { kind: "distress" },
    };
    for (const [fixtureCase, decision] of Object.entries(expected)) {
      const { decision: got, requests } = await classify(fixtureCase);
      expect(got, fixtureCase).toEqual(decision);
      expect(requests, fixtureCase).toHaveLength(1);
    }
  });

  it("a question about the course that also says something worrying is on topic and distress: distress wins", async () => {
    const { result } = await classify("classify-mixed");
    expect(result).toEqual({ ok: true, value: { onTopic: true, sensitive: false, distress: true } });
  });

  it("an unreadable answer is retried exactly once, then the tutor is unavailable — no answer model", async () => {
    const { decision, requests } = await classify("classify-schema-violation");
    expect(requests).toHaveLength(2);
    expect(decision).toEqual({ kind: "unavailable" });
  });

  it("sends the question and the course, with the factory's rewriting", async () => {
    const { requests } = await classify("classify-on-topic");
    const sent = JSON.stringify(requests[0]);
    expect(sent).toContain("c koi un verbe ?");
    expect(sent).toContain("Le verbe indique ce que fait le sujet");
    expect(requests[0]).not.toHaveProperty("temperature");
    expect(requests[0]?.thinking).toEqual({ type: "disabled" });
  });
});

describe(`ClaudeChatModel contract (${FIXTURE_SOURCE} fixtures)`, () => {
  it("streams the recorded answer, piece by piece, from one streamed request", async () => {
    const replay = replayFetch(loadFixture("tutor", "answer"));
    const chat = new ClaudeChatModel(createLanguageModel({ apiKey: "k", fetch: replay.fetch, maxTokens: ANSWER_MAX_TOKENS }));

    const chunks: string[] = [];
    for await (const chunk of chat.stream({ question: questionOf("answer"), sections: sectionsOf(lessonMarkdown()), history: [], grade: "CE2" })) chunks.push(chunk);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join("")).toMatch(/^Bonne question ! Un verbe, c'est le mot qui dit ce que fait quelqu'un/);
    expect(replay.requests).toHaveLength(1);
    expect(replay.requests[0]).toMatchObject({ stream: true, max_tokens: ANSWER_MAX_TOKENS, thinking: { type: "disabled" } });
    expect(replay.requests[0]).not.toHaveProperty("temperature");
  });
});

describe(`ClaudeCitationExtractor contract (${FIXTURE_SOURCE} fixtures)`, () => {
  it("cites sections that exist in the lesson, in one call", async () => {
    const sections = sectionsOf(lessonMarkdown());
    const replay = replayFetch(loadFixture("tutor", "citations"));
    const extractor = new ClaudeCitationExtractor(createLanguageModel({ apiKey: "k", fetch: replay.fetch }));

    const result = await extractor.extract({ answer: "Un verbe, c'est le mot qui dit ce que fait quelqu'un.", sections });

    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.sectionIndexes.length).toBeGreaterThan(0);
    for (const index of result.value.sectionIndexes) expect(index).toBeLessThan(sections.length);
    expect(replay.requests).toHaveLength(1);
  });
});
