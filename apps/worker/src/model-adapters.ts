import {
  ClaudeCourseNamer,
  ClaudeExerciseGenerator,
  ClaudeItemSplitter,
  ClaudePhotoExtractor,
  createLanguageModel,
  FixtureCourseNamer,
  FixtureExerciseGenerator,
  FixtureItemSplitter,
  FixturePhotoExtractor,
  type CourseNamer,
  type ExerciseGenerator,
  type ItemSplitter,
  type PhotoExtractor,
} from "@studiakids/core";
import { fileURLToPath } from "node:url";

// The recorded fixtures (pnpm fixtures:record), same switch as
// FIXTURE_SOURCE in tests/support/llm-fixtures.ts.
const FIXTURES_ROOT = fileURLToPath(new URL("../../../tests/fixtures", import.meta.url));
const INGESTION_FIXTURES_DIR = `${FIXTURES_ROOT}/ingestion`;

export interface ModelAdapters {
  extractor: PhotoExtractor;
  namer: CourseNamer;
  splitter: ItemSplitter;
  generator: ExerciseGenerator;
}

// LLM_ADAPTER=fixture is what e2e runs set (CLAUDE.md, Commandes); anything
// else must be an explicit, real configuration.
export function selectModelAdapters(env: NodeJS.ProcessEnv): ModelAdapters {
  if (env.LLM_ADAPTER === "fixture") {
    return {
      extractor: new FixturePhotoExtractor(INGESTION_FIXTURES_DIR),
      namer: new FixtureCourseNamer(INGESTION_FIXTURES_DIR),
      splitter: new FixtureItemSplitter(FIXTURES_ROOT),
      generator: new FixtureExerciseGenerator(FIXTURES_ROOT),
    };
  }
  if (env.LLM_ADAPTER !== undefined && env.LLM_ADAPTER !== "real") {
    throw new Error(`Unknown LLM_ADAPTER "${env.LLM_ADAPTER}": expected "fixture" or "real".`);
  }
  // Not a startup failure: docker-start.mjs brings the whole container down
  // when the worker exits, API included. Without a key every extraction
  // fails through the jobs kernel's retries instead, and the child sees
  // the retry screen. Whether to fail fast here is an open question.
  if (!env.ANTHROPIC_API_KEY) console.error("[worker] ANTHROPIC_API_KEY is not set: every extraction will fail.");
  const model = createLanguageModel({ apiKey: env.ANTHROPIC_API_KEY ?? "", model: env.ANTHROPIC_MODEL });
  return { extractor: new ClaudePhotoExtractor(model), namer: new ClaudeCourseNamer(model), splitter: new ClaudeItemSplitter(model), generator: new ClaudeExerciseGenerator(model) };
}
