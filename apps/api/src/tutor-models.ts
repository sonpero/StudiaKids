import { fileURLToPath } from "node:url";
import {
  ANSWER_MAX_TOKENS,
  ClaudeChatModel,
  ClaudeCitationExtractor,
  ClaudeQuestionClassifier,
  createLanguageModel,
  FixtureChatModel,
  FixtureCitationExtractor,
  FixtureQuestionClassifier,
  type ChatModel,
  type CitationExtractor,
  type QuestionClassifier,
  err,
} from "@studiakids/core";

// The tutor answers inside a request: its models live in the API, not the
// worker. Same switch as the worker's (apps/worker/src/model-adapters.ts).
const FIXTURES_ROOT = fileURLToPath(new URL("../../../tests/fixtures", import.meta.url));

// Chosen on the golden set at M6 (tests/eval/results/tutor-prompts-v1.json):
// the highest distress recall.
const DEFAULT_CLASSIFIER_MODEL = "claude-sonnet-5";

export interface TutorModels {
  classifier: QuestionClassifier;
  chat: ChatModel;
  citations: CitationExtractor;
}

// `fetch` only for tests: production uses the global one.
export function selectTutorModels(env: NodeJS.ProcessEnv, fetch?: typeof globalThis.fetch): TutorModels {
  if (env.LLM_ADAPTER === "fixture") {
    return { classifier: new FixtureQuestionClassifier(FIXTURES_ROOT), chat: new FixtureChatModel(FIXTURES_ROOT), citations: new FixtureCitationExtractor(FIXTURES_ROOT) };
  }
  if (env.LLM_ADAPTER !== undefined && env.LLM_ADAPTER !== "real") {
    throw new Error(`Unknown LLM_ADAPTER "${env.LLM_ADAPTER}": expected "fixture" or "real".`);
  }
  // Without a key every classification fails: the child sees the fixed
  // « ask again » message, never an answer from nowhere.
  const apiKey = env.ANTHROPIC_API_KEY ?? "";
  const withFetch = fetch === undefined ? {} : { fetch };
  return {
    classifier: new ClaudeQuestionClassifier(createLanguageModel({ apiKey, model: env.CLASSIFIER_MODEL ?? DEFAULT_CLASSIFIER_MODEL, ...withFetch })),
    // The factory rewrites max_tokens on every request: the ceiling is set here.
    chat: new ClaudeChatModel(createLanguageModel({ apiKey, model: env.ANTHROPIC_MODEL, maxTokens: ANSWER_MAX_TOKENS, ...withFetch })),
    citations: new ClaudeCitationExtractor(createLanguageModel({ apiKey, model: env.ANTHROPIC_MODEL, ...withFetch })),
  };
}

// No model at all: every classification fails, so every question gets the
// fixed « ask again » message and nothing is ever generated.
export const OFFLINE_TUTOR: TutorModels = {
  classifier: { classify: () => Promise.resolve(err({ kind: "model-error", message: "tutor models not configured" })) },
  chat: {
    stream: () => {
      throw new Error("tutor models not configured");
    },
  },
  citations: { extract: () => Promise.resolve(err({ kind: "invalid-output", message: "tutor models not configured" })) },
};
