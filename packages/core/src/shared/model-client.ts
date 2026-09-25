import { createAnthropic } from "@ai-sdk/anthropic";
import { wrapLanguageModel, type LanguageModel, type LanguageModelV1Middleware } from "ai";

export interface ModelClientConfig {
  apiKey: string;
  model?: string;
  // Replaces the HTTP transport. Only tests and `pnpm fixtures:record`
  // pass it (to capture raw responses); production uses the global fetch.
  fetch?: typeof fetch;
}

export const DEFAULT_MODEL = "claude-sonnet-5";

// REMOVE WHEN MOVING TO ai v5+ (docs/modules/ingestion.md, "Client modèle").
// ai 4.x sends temperature: 0 whenever the caller leaves it unset, and
// claude-sonnet-5 rejects every sampling parameter with a 400. Stripping
// them here, once, keeps every adapter unaware of the problem.
const stripSamplingParams: LanguageModelV1Middleware = {
  transformParams: ({ params }) =>
    Promise.resolve({ ...params, temperature: undefined, topP: undefined, topK: undefined }),
};

// The one factory every real LLM adapter builds its client from (never used
// by fixture adapters, which is what keeps `pnpm test` network-free). Takes
// its config as a parameter rather than reading process.env itself, same
// convention as HmacSessionCodec/Argon2PasswordHasher: the caller (apps/api
// or apps/worker wiring) reads ANTHROPIC_API_KEY and ANTHROPIC_MODEL and
// passes them down.
export function createLanguageModel(config: ModelClientConfig): LanguageModel {
  const anthropic = createAnthropic({ apiKey: config.apiKey, fetch: config.fetch });
  return wrapLanguageModel({
    model: anthropic(config.model ?? DEFAULT_MODEL),
    middleware: stripSamplingParams,
  });
}
