import { describe, expect, it } from "vitest";
import { createLanguageModel } from "../../shared/index.js";
import { ClaudeExerciseGenerator } from "./claude-exercise-generator.js";
import { ClaudeItemSplitter } from "./claude-item-splitter.js";
import { PROMPTS_VERSION } from "./prompts.js";

// Minimal stand-ins for the Messages API (not LLM fixtures): the request
// each adapter sends, and what it makes of an answer.
function stubApi(toolInputs: unknown[]) {
  const requests: Record<string, unknown>[] = [];
  const fetch = (_input: Parameters<typeof globalThis.fetch>[0], init?: RequestInit): Promise<Response> => {
    requests.push(JSON.parse(typeof init?.body === "string" ? init.body : "{}") as Record<string, unknown>);
    const input = toolInputs[requests.length - 1];
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
  return { fetch, requests };
}
const text = (request: Record<string, unknown>) => JSON.stringify(request.messages);
const schemaOf = (request: Record<string, unknown>) => JSON.stringify((request.tools as { input_schema: unknown }[])[0]?.input_schema);
const lesson = "# Le château fort\nLe donjon est la tour la plus haute.";

describe("prompts", () => {
  it("are versioned, so an evaluation score always names the prompts it measured", () => {
    expect(PROMPTS_VERSION).toMatch(/^\d+$/);
  });
});

describe("ClaudeItemSplitter", () => {
  it("sends the lesson and its grade, asks for the lesson's own words and at most 3 game types, and returns the proposals", async () => {
    const api = stubApi([{ items: [{ title: "Le donjon", body: "Le donjon est la tour la plus haute.", gameTypes: ["mcq", "quiz"] }] }]);
    const splitter = new ClaudeItemSplitter(createLanguageModel({ apiKey: "k", fetch: api.fetch }));

    const result = await splitter.split({ markdown: lesson, grade: "CM1" });

    expect(result).toEqual({ ok: true, value: [{ title: "Le donjon", body: "Le donjon est la tour la plus haute.", applicableGameTypes: ["mcq", "quiz"] }] });
    const prompt = text(api.requests[0]!);
    expect(prompt).toContain("CM1");
    expect(prompt).toContain("Le donjon est la tour la plus haute.");
    expect(prompt).toMatch(/recopie la leçon/);
    expect(prompt).toMatch(/1 à 3 types/);
  });

  it("repairs a list sent as a JSON string, without a retry", async () => {
    const api = stubApi([{ items: JSON.stringify([{ title: "Le donjon", body: "b", gameTypes: ["mcq"] }]) }]);
    const splitter = new ClaudeItemSplitter(createLanguageModel({ apiKey: "k", fetch: api.fetch }));

    expect((await splitter.split({ markdown: lesson, grade: "CM1" })).ok).toBe(true);
    expect(api.requests).toHaveLength(1);
  });
});

describe("ClaudeExerciseGenerator", () => {
  const items = [{ title: "Le donjon", body: "Le donjon est la tour la plus haute." }];

  it("states the anchoring rule first, sends the lesson and the numbered items, and returns the raw exercises unchecked", async () => {
    const answer = [{ item: 0, statement: "Le donjon est la tour la plus haute.", answer: true }, { item: 7, statement: 3 }];
    const api = stubApi([{ exercises: answer }]);
    const generator = new ClaudeExerciseGenerator(createLanguageModel({ apiKey: "k", fetch: api.fetch }));

    const result = await generator.generate({ type: "true_false", items, courseMarkdown: lesson, grade: "CM1" });

    // Never refused as a whole: the malformed exercise comes back as null
    // and is dropped in domain/ with the other invalid ones.
    expect(result).toEqual({ ok: true, value: [answer[0], null] });
    const prompt = text(api.requests[0]!);
    expect(prompt).toMatch(/vérifier dans le texte de la leçon/);
    expect(prompt.indexOf("Règle d'ancrage")).toBeLessThan(prompt.indexOf("vraie ou fausse"));
    expect(prompt).toContain("0. Le donjon");
    expect(prompt).toContain(lesson.split("\n")[1]);
  });

  it("uses one flat schema per game type, never a union", async () => {
    for (const [type, field] of [
      ["mcq", "options"],
      ["cloze", "blanks"],
      ["matching", "pairs"],
      ["reordering", "elements"],
      ["delayed_copy", "wordOrPhrase"],
      ["mental_math", "question"],
      ["true_false", "statement"],
    ] as const) {
      const api = stubApi([{ exercises: [] }]);
      await new ClaudeExerciseGenerator(createLanguageModel({ apiKey: "k", fetch: api.fetch })).generate({ type, items, courseMarkdown: lesson, grade: "CM1" });
      const schema = schemaOf(api.requests[0]!);
      expect(schema).toContain(`"${field}"`);
      expect(schema).not.toMatch(/anyOf|oneOf/);
    }
  });

  it("an unreadable answer goes through the single retry, then fails", async () => {
    const api = stubApi([{ nothing: 1 }, { still: 2 }]);
    const generator = new ClaudeExerciseGenerator(createLanguageModel({ apiKey: "k", fetch: api.fetch }));

    expect((await generator.generate({ type: "mcq", items, courseMarkdown: lesson, grade: "CM1" })).ok).toBe(false);
    expect(api.requests).toHaveLength(2);
  });
});
