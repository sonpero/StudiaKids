import { ClaudeCourseNamer, ClaudePhotoExtractor, createLanguageModel, FixtureCourseNamer, FixturePhotoExtractor, type CourseNamer, type PhotoExtractor } from "@studiakids/core";
import { fileURLToPath } from "node:url";

// The recorded fixtures (pnpm fixtures:record), same switch as
// FIXTURE_SOURCE in tests/support/llm-fixtures.ts.
const FIXTURES_DIR = fileURLToPath(new URL("../../../tests/fixtures/ingestion", import.meta.url));

export interface ModelAdapters {
  extractor: PhotoExtractor;
  namer: CourseNamer;
}

// LLM_ADAPTER=fixture is what e2e runs set (CLAUDE.md, Commandes); anything
// else must be an explicit, real configuration.
export function selectModelAdapters(env: NodeJS.ProcessEnv): ModelAdapters {
  if (env.LLM_ADAPTER === "fixture") {
    return { extractor: new FixturePhotoExtractor(FIXTURES_DIR), namer: new FixtureCourseNamer(FIXTURES_DIR) };
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
  return { extractor: new ClaudePhotoExtractor(model), namer: new ClaudeCourseNamer(model) };
}
