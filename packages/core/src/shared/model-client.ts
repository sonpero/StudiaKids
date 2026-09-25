import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";

export interface ModelClientConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
  // Replaces the HTTP transport. Only tests and `pnpm fixtures:record`
  // pass it (to capture raw responses); production uses the global fetch.
  fetch?: typeof fetch;
}

export const DEFAULT_MODEL = "claude-sonnet-5";

// A dense course page is a few thousand output tokens at most, even with
// claude-sonnet-5's heavier tokenizer; 16k leaves ample room while staying
// under the SDK's non-streaming HTTP timeout.
export const DEFAULT_MAX_TOKENS = 16_000;

// The single point of adaptation to claude-sonnet-5 that ai 4.x /
// @ai-sdk/anthropic 1.2.12 cannot express. REMOVE WHEN MOVING TO ai v5+
// (docs/modules/ingestion.md, "Client modèle"), moving max_tokens to the
// callers' maxTokens setting:
// - ai 4.x always sends temperature: 0, and claude-sonnet-5 rejects every
//   sampling parameter with a 400;
// - the provider only forwards `thinking` when it is "enabled", while
//   claude-sonnet-5 thinks adaptively by default, eating into max_tokens;
// - the provider defaults max_tokens to 4096, too tight for a dense page.
function adaptRequestBody(body: Record<string, unknown>, maxTokens: number): Record<string, unknown> {
  const { temperature: _temperature, top_p: _topP, top_k: _topK, ...rest } = body;
  return { ...rest, max_tokens: maxTokens, thinking: { type: "disabled" } };
}

function adaptingFetch(inner: typeof fetch | undefined, maxTokens: number): typeof fetch {
  return (input, init) => {
    // Resolved per call, never captured at construction: the test network
    // guard replaces globalThis.fetch and must keep applying.
    const send = inner ?? globalThis.fetch;
    if (typeof init?.body !== "string") return send(input, init);
    const body = JSON.parse(init.body) as Record<string, unknown>;
    return send(input, { ...init, body: JSON.stringify(adaptRequestBody(body, maxTokens)) });
  };
}

// The one factory every real LLM adapter builds its client from (never used
// by fixture adapters, which is what keeps `pnpm test` network-free). Takes
// its config as a parameter rather than reading process.env itself, same
// convention as HmacSessionCodec/Argon2PasswordHasher: the caller (apps/api
// or apps/worker wiring) reads ANTHROPIC_API_KEY and ANTHROPIC_MODEL and
// passes them down.
export function createLanguageModel(config: ModelClientConfig): LanguageModel {
  const anthropic = createAnthropic({
    apiKey: config.apiKey,
    fetch: adaptingFetch(config.fetch, config.maxTokens ?? DEFAULT_MAX_TOKENS),
  });
  return anthropic(config.model ?? DEFAULT_MODEL);
}
