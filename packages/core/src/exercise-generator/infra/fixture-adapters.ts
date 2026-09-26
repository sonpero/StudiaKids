import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { Grade } from "../../auth/index.js";
import { createLanguageModel, err, type Result } from "../../shared/index.js";
import type { GameType } from "../domain/game-types.js";
import type { ItemProposal } from "../domain/items.js";
import type { ExerciseGenerator, GenerationError, ItemSplitter } from "../domain/ports.js";
import { ClaudeExerciseGenerator } from "./claude-exercise-generator.js";
import { ClaudeItemSplitter } from "./claude-item-splitter.js";

// A fixture file holds raw Messages API responses (pnpm fixtures:record,
// docs/modules/exercise-generator.md); `source` names the fixture whose
// answer was the recorded call's input.
const fixtureFileSchema = z.object({
  source: z.string().optional(),
  exchanges: z.array(z.object({ status: z.number(), body: z.unknown() })),
});
type FixtureFile = z.infer<typeof fixtureFileSchema>;
const extractionAnswerSchema = z.object({
  exchanges: z.array(z.object({ body: z.object({ content: z.array(z.object({ type: z.string(), input: z.object({ markdown: z.string() }).partial().optional() })) }) })),
});

const readFixture = (file: string): FixtureFile => fixtureFileSchema.parse(JSON.parse(readFileSync(file, "utf8")));

// The recorded responses, served in order to the real adapter: validation,
// repair and retry run exactly as in production, and nothing reaches the
// network.
function replayModel(fixture: FixtureFile) {
  let next = 0;
  const fetch = (): Promise<Response> => {
    const exchange = fixture.exchanges[next++];
    if (!exchange) return Promise.reject(new Error("fixture has no response left"));
    const body = typeof exchange.body === "string" ? exchange.body : JSON.stringify(exchange.body);
    return Promise.resolve(new Response(body, { status: exchange.status, headers: { "content-type": "application/json" } }));
  };
  return createLanguageModel({ apiKey: "fixture", fetch });
}

const missing = (message: string): Result<never, GenerationError> => err({ kind: "model-error", message });

// Stands in for ClaudeItemSplitter in the worker when LLM_ADAPTER=fixture
// (e2e). A split fixture answers the text of the ingestion fixture it was
// recorded on — or a course of several photos of that same page, whose
// text repeats it. An unknown text is a loud failure, never invented items.
export class FixtureItemSplitter implements ItemSplitter {
  private readonly splits: { markdown: string; file: string }[] = [];

  constructor(fixturesRoot: string) {
    const dir = path.join(fixturesRoot, "exercise-generator");
    for (const name of readdirSync(dir).filter((file) => /^split(-[\w-]+)?\.json$/.test(file))) {
      const file = path.join(dir, name);
      const source = readFixture(file).source;
      if (!source) throw new Error(`split fixture without a source: ${name}`);
      const answer = extractionAnswerSchema.parse(JSON.parse(readFileSync(path.join(fixturesRoot, source), "utf8")));
      const markdown = answer.exchanges[0]?.body.content.find((block) => block.type === "tool_use")?.input?.markdown;
      if (!markdown) throw new Error(`the source of ${name} has no Markdown: ${source}`);
      this.splits.push({ markdown, file });
    }
    // The longest text first: a page's text may contain a shorter one's.
    this.splits.sort((a, b) => b.markdown.length - a.markdown.length);
  }

  split(input: { markdown: string; grade: Grade }): Promise<Result<ItemProposal[], GenerationError>> {
    const match = this.splits.find((split) => input.markdown.includes(split.markdown));
    if (!match) return Promise.resolve(missing("no split fixture for this text"));
    return new ClaudeItemSplitter(replayModel(readFixture(match.file))).split(input);
  }
}

// Stands in for ClaudeExerciseGenerator: the recorded answer of each type
// (generate-<type>.json), whatever items it is asked about — an exercise
// pointing past the list is dropped by the job, like a model's would be.
export class FixtureExerciseGenerator implements ExerciseGenerator {
  constructor(private readonly fixturesRoot: string) {}

  generate(input: { type: GameType; items: { title: string; body: string }[]; courseMarkdown: string; grade: Grade }): Promise<Result<unknown[], GenerationError>> {
    const file = path.join(this.fixturesRoot, "exercise-generator", `generate-${input.type}.json`);
    if (!existsSync(file)) return Promise.resolve(missing(`no generation fixture for ${input.type}`));
    return new ClaudeExerciseGenerator(replayModel(readFixture(file))).generate(input);
  }
}
