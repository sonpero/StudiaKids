import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { Grade } from "../../auth/index.js";
import { createLanguageModel, err, type Result } from "../../shared/index.js";
import type { Classification, ClassificationError } from "../domain/decision.js";
import type { ChatModel, CitationExtractor, CourseForTutor, ExtractError, QuestionClassifier } from "../domain/ports.js";
import type { Section } from "../domain/split-into-sections.js";
import { ANSWER_MAX_TOKENS, ClaudeChatModel } from "./claude-chat-model.js";
import { ClaudeCitationExtractor } from "./claude-citation-extractor.js";
import { ClaudeQuestionClassifier } from "./claude-question-classifier.js";

// A tutor fixture holds raw Messages API responses (pnpm fixtures:record
// tutor); a classification names the question it was recorded on.
const fixtureFileSchema = z.object({
  question: z.string().optional(),
  degradedFrom: z.string().optional(),
  exchanges: z.array(z.object({ status: z.number(), body: z.unknown() })),
});
type FixtureFile = z.infer<typeof fixtureFileSchema>;
const readFixture = (file: string): FixtureFile => fixtureFileSchema.parse(JSON.parse(readFileSync(file, "utf8")));

// The recorded responses, served in order to the real adapter; nothing
// reaches the network.
function replayModel(fixture: FixtureFile, maxTokens?: number) {
  let next = 0;
  const fetch = (): Promise<Response> => {
    const exchange = fixture.exchanges[next++];
    if (!exchange) return Promise.reject(new Error("fixture has no response left"));
    const body = typeof exchange.body === "string" ? exchange.body : JSON.stringify(exchange.body);
    return Promise.resolve(new Response(body, { status: exchange.status, headers: { "content-type": "application/json" } }));
  };
  return createLanguageModel({ apiKey: "fixture", fetch, ...(maxTokens === undefined ? {} : { maxTokens }) });
}

// Stands in for ClaudeQuestionClassifier in the API when LLM_ADAPTER=fixture
// (e2e): each recorded question gets its recorded answer; any other
// question is a failed classification — the e2e path for « the tutor could
// not read your question ».
export class FixtureQuestionClassifier implements QuestionClassifier {
  private readonly byQuestion = new Map<string, string>();

  constructor(fixturesRoot: string) {
    const dir = path.join(fixturesRoot, "tutor");
    for (const name of readdirSync(dir).filter((file) => file.startsWith("classify-"))) {
      const fixture = readFixture(path.join(dir, name));
      if (fixture.question !== undefined && fixture.degradedFrom === undefined) this.byQuestion.set(fixture.question.trim(), path.join(dir, name));
    }
  }

  classify(input: { question: string; course: CourseForTutor }): Promise<Result<Classification, ClassificationError>> {
    const file = this.byQuestion.get(input.question.trim());
    if (!file) return Promise.resolve(err({ kind: "model-error", message: "no classification fixture for this question" }));
    return new ClaudeQuestionClassifier(replayModel(readFixture(file))).classify(input);
  }
}

// The recorded answer, whatever the question (only on-topic questions
// ever reach it).
export class FixtureChatModel implements ChatModel {
  constructor(private readonly fixturesRoot: string) {}

  stream(input: { question: string; sections: Section[]; history: { role: "user" | "assistant"; content: string }[]; grade: Grade }): AsyncIterable<string> {
    return new ClaudeChatModel(replayModel(readFixture(path.join(this.fixturesRoot, "tutor", "answer.json")), ANSWER_MAX_TOKENS)).stream(input);
  }
}

export class FixtureCitationExtractor implements CitationExtractor {
  constructor(private readonly fixturesRoot: string) {}

  extract(input: { answer: string; sections: Section[] }): Promise<Result<{ sectionIndexes: number[] }, ExtractError>> {
    return new ClaudeCitationExtractor(replayModel(readFixture(path.join(this.fixturesRoot, "tutor", "citations.json")))).extract(input);
  }
}
