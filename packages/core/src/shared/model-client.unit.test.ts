import { generateObject, generateText } from "ai";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createLanguageModel, DEFAULT_MODEL } from "./model-client.js";

// Stands in for the network: records each request body and answers with a
// minimal Anthropic Messages API response, so no test ever leaves the
// process (tests/support/no-network.ts would throw otherwise).
function recordingFetch(content: unknown[]): { fetch: typeof fetch; bodies: Record<string, unknown>[] } {
  const bodies: Record<string, unknown>[] = [];
  const fakeFetch = (_input: Parameters<typeof fetch>[0], init?: RequestInit): Promise<Response> => {
    // The AI SDK always sends the Messages API body as a JSON string.
    if (typeof init?.body !== "string") throw new Error("expected a JSON string body");
    bodies.push(JSON.parse(init.body) as Record<string, unknown>);
    return Promise.resolve(
      new Response(
        JSON.stringify({
          id: "msg_test",
          type: "message",
          role: "assistant",
          model: DEFAULT_MODEL,
          content,
          stop_reason: "end_turn",
          stop_sequence: null,
          usage: { input_tokens: 1, output_tokens: 1 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
  };
  return { fetch: fakeFetch, bodies };
}

describe("createLanguageModel", () => {
  it("builds a language model for the given model id without making any network call", () => {
    const model = createLanguageModel({ apiKey: "test-key", model: "claude-opus-5" });

    expect(model.modelId).toBe("claude-opus-5");
    expect(model.provider).toContain("anthropic");
  });

  it("defaults to claude-sonnet-5 when no model is given (ANTHROPIC_MODEL unset)", () => {
    const model = createLanguageModel({ apiKey: "test-key" });

    expect(DEFAULT_MODEL).toBe("claude-sonnet-5");
    expect(model.modelId).toBe("claude-sonnet-5");
  });

  // ai 4.x sends temperature: 0 when the caller sets nothing, and
  // claude-sonnet-5 rejects any sampling parameter with a 400.
  it("never sends temperature, top_p or top_k, even when the caller sets them", async () => {
    const { fetch, bodies } = recordingFetch([{ type: "text", text: "ok" }]);
    const model = createLanguageModel({ apiKey: "test-key", fetch });

    await generateText({ model, prompt: "hi" });
    await generateText({ model, prompt: "hi", temperature: 0.7, topP: 0.9, topK: 5 });

    expect(bodies).toHaveLength(2);
    for (const body of bodies) {
      expect(body).not.toHaveProperty("temperature");
      expect(body).not.toHaveProperty("top_p");
      expect(body).not.toHaveProperty("top_k");
    }
  });

  it("keeps generateObject working: the forced tool call still goes out, without sampling params", async () => {
    const { fetch, bodies } = recordingFetch([{ type: "tool_use", id: "toolu_1", name: "json", input: { title: "Les fractions" } }]);
    const model = createLanguageModel({ apiKey: "test-key", fetch });

    const { object } = await generateObject({ model, schema: z.object({ title: z.string() }), prompt: "hi" });

    expect(object).toEqual({ title: "Les fractions" });
    expect(bodies[0]).toMatchObject({ tool_choice: { type: "tool", name: "json" } });
    expect(bodies[0]).not.toHaveProperty("temperature");
  });
});
