import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createLanguageModel } from "../../shared/index.js";
import { generateWithRetry } from "./generate-with-retry.js";

function stubApi(toolInputs: unknown[]): { fetch: typeof fetch; requests: number } {
  const state = { requests: 0 };
  const stub = (): Promise<Response> => {
    const input = toolInputs[state.requests];
    state.requests++;
    return Promise.resolve(
      new Response(
        JSON.stringify({
          id: "msg_stub",
          type: "message",
          role: "assistant",
          model: "claude-sonnet-5",
          content: [{ type: "tool_use", id: "toolu_stub", name: "json", input }],
          stop_reason: "tool_use",
          stop_sequence: null,
          usage: { input_tokens: 1, output_tokens: 1 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
  };
  return { fetch: stub, get requests() { return state.requests; } };
}

const exercisesSchema = z.object({ title: z.string(), exercises: z.array(z.object({ item: z.number() })) });
const run = (inputs: unknown[]) => {
  const api = stubApi(inputs);
  return { api, result: generateWithRetry(createLanguageModel({ apiKey: "k", fetch: api.fetch }), exercisesSchema, () => [{ role: "user", content: "x" }]) };
};

// Observed at M3's opening: claude-sonnet-5 returns a root array encoded
// as a JSON string in 6 calls out of 7, sometimes re-wrapped in its key.
describe("generateWithRetry repairs arrays sent as JSON strings", () => {
  it("decodes an array sent as a string, without a retry", async () => {
    const { api, result } = run([{ title: "T", exercises: JSON.stringify([{ item: 0 }, { item: 1 }]) }]);

    expect(await result).toEqual({ ok: true, value: { title: "T", exercises: [{ item: 0 }, { item: 1 }] } });
    expect(api.requests).toBe(1);
  });

  it("unwraps an array re-wrapped in its own key", async () => {
    const { result } = run([{ title: "T", exercises: JSON.stringify({ exercises: [{ item: 2 }] }) }]);

    expect(await result).toEqual({ ok: true, value: { title: "T", exercises: [{ item: 2 }] } });
  });

  it("decodes a string encoded twice", async () => {
    const { result } = run([{ title: "T", exercises: JSON.stringify(JSON.stringify([{ item: 3 }])) }]);

    expect(await result).toEqual({ ok: true, value: { title: "T", exercises: [{ item: 3 }] } });
  });

  it("never touches a string field that is meant to be a string, even if it looks like JSON", async () => {
    const { result } = run([{ title: "[1, 2]", exercises: JSON.stringify([{ item: 0 }]) }]);

    expect(await result).toEqual({ ok: true, value: { title: "[1, 2]", exercises: [{ item: 0 }] } });
  });

  it("an answer beyond repair still goes through the single retry", async () => {
    const { api, result } = run([{ title: "T", exercises: "not json" }, { title: "T", exercises: [{ item: 0 }] }]);

    expect(await result).toEqual({ ok: true, value: { title: "T", exercises: [{ item: 0 }] } });
    expect(api.requests).toBe(2);
  });
});
