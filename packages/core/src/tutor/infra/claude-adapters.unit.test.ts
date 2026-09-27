import { describe, expect, it } from "vitest";
import { createLanguageModel } from "../../shared/index.js";
import { ClaudeChatModel } from "./claude-chat-model.js";
import { ClaudeCitationExtractor } from "./claude-citation-extractor.js";
import { ClaudeQuestionClassifier } from "./claude-question-classifier.js";
import { TUTOR_PROMPTS_VERSION } from "./prompts.js";

// Minimal stand-ins for the Messages API (not LLM fixtures): what each
// adapter sends, and what it makes of an answer.
function toolReply(input: unknown) {
  return new Response(
    JSON.stringify({ id: "msg", type: "message", role: "assistant", model: "m", content: [{ type: "tool_use", id: "t", name: "json", input }], stop_reason: "tool_use", stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}
function stubApi(replies: (() => Response | Promise<Response>)[]) {
  const requests: Record<string, unknown>[] = [];
  const fetch = (_input: Parameters<typeof globalThis.fetch>[0], init?: RequestInit): Promise<Response> => {
    requests.push(JSON.parse(typeof init?.body === "string" ? init.body : "{}") as Record<string, unknown>);
    const reply = replies[requests.length - 1];
    return Promise.resolve(reply ? reply() : toolReply({}));
  };
  return { fetch, requests };
}
const course = { title: "Le verbe", subject: "french", grade: "CE2" as const, markdown: "# Le verbe\n\nLe verbe indique ce que fait le sujet." };
const text = (request: Record<string, unknown>) => JSON.stringify(request.messages) + JSON.stringify(request.system ?? "");

describe("tutor prompts", () => {
  it("are versioned, so an evaluation score always names the prompts it measured", () => {
    expect(TUTOR_PROMPTS_VERSION).toMatch(/^\d+$/);
  });
});

describe("ClaudeQuestionClassifier", () => {
  it("sends the question, the course and securite.md's definitions; reads the three flags", async () => {
    const api = stubApi([() => toolReply({ onTopic: true, sensitive: false, distress: false })]);
    const classifier = new ClaudeQuestionClassifier(createLanguageModel({ apiKey: "k", fetch: api.fetch }));

    const result = await classifier.classify({ question: "c koi un verbe", course });

    expect(result).toEqual({ ok: true, value: { onTopic: true, sensitive: false, distress: false } });
    const sent = text(api.requests[0]!);
    expect(sent).toContain("c koi un verbe");
    expect(sent).toContain("Le verbe indique ce que fait le sujet.");
    expect(sent).toMatch(/détresse/);
    expect(sent).toMatch(/programme/);
  });

  it("an unreadable answer is retried once, then an error — never an exception", async () => {
    const api = stubApi([() => toolReply({ onTopic: "oui" }), () => toolReply({ distress: 3 })]);
    const classifier = new ClaudeQuestionClassifier(createLanguageModel({ apiKey: "k", fetch: api.fetch }));

    const result = await classifier.classify({ question: "?", course });

    expect(result.ok).toBe(false);
    expect(api.requests).toHaveLength(2);
  });

  it("a network failure is an error, never an exception", async () => {
    const api = stubApi([() => Promise.reject(new Error("offline")), () => Promise.reject(new Error("offline"))]);
    const classifier = new ClaudeQuestionClassifier(createLanguageModel({ apiKey: "k", fetch: api.fetch }));

    expect((await classifier.classify({ question: "?", course })).ok).toBe(false);
  });

  it("an answer that takes too long is an error: the child never waits forever", async () => {
    const api = stubApi([() => new Promise<Response>(() => undefined)]);
    const classifier = new ClaudeQuestionClassifier(createLanguageModel({ apiKey: "k", fetch: api.fetch }), 20);

    expect(await classifier.classify({ question: "?", course })).toMatchObject({ ok: false, error: { kind: "model-error" } });
  });
});

describe("ClaudeChatModel", () => {
  it("answers from the course, for the child's grade, under securite.md's rules on generated text", async () => {
    const api = stubApi([]);
    const chat = new ClaudeChatModel(createLanguageModel({ apiKey: "k", fetch: api.fetch }));

    const stream = chat.stream({ question: "Et finir ?", sections: [{ index: 0, text: "Le verbe indique ce que fait le sujet." }], history: [{ role: "user", content: "c koi un verbe" }, { role: "assistant", content: "Un mot d'action." }], grade: "CE2" });
    try {
      for await (const _chunk of stream) break;
    } catch {
      // the stub is not a stream: only the request matters here
    }

    const sent = text(api.requests[0]!);
    expect(sent).toContain("[0] Le verbe indique ce que fait le sujet.");
    expect(sent).toContain("CE2");
    expect(sent).toContain("c koi un verbe");
    for (const rule of [/sentiment/, /secret/, /adulte/, /information personnelle/, /performances|résultats/]) expect(sent).toMatch(rule);
  });
});

describe("ClaudeCitationExtractor", () => {
  const sections = [{ index: 0, text: "Le verbe indique ce que fait le sujet." }, { index: 1, text: "L'infinitif ne change pas." }];

  it("reads the indexes of the sections the answer uses", async () => {
    const api = stubApi([() => toolReply({ sectionIndexes: [1] })]);
    expect(await new ClaudeCitationExtractor(createLanguageModel({ apiKey: "k", fetch: api.fetch })).extract({ answer: "…", sections })).toEqual({ ok: true, value: { sectionIndexes: [1] } });
  });

  it("an index out of bounds is retried once, then an error", async () => {
    const api = stubApi([() => toolReply({ sectionIndexes: [7] }), () => toolReply({ sectionIndexes: [9] })]);
    const result = await new ClaudeCitationExtractor(createLanguageModel({ apiKey: "k", fetch: api.fetch })).extract({ answer: "…", sections });
    expect(result.ok).toBe(false);
    expect(api.requests).toHaveLength(2);
  });
});

// ai 4.x hands a stream's errors to onError and just ends textStream: an
// interrupted answer would pass for a complete one. The adapter must throw.
describe("ClaudeChatModel, an interrupted answer", () => {
  const event = (type: string, data: unknown) => `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
  const start = event("message_start", { type: "message_start", message: { id: "m", type: "message", role: "assistant", model: "m", content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } } });
  const block = event("content_block_start", { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } });
  const delta = (text: string) => event("content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text } });
  const end = (stop: string) =>
    event("content_block_stop", { type: "content_block_stop", index: 0 }) +
    event("message_delta", { type: "message_delta", delta: { stop_reason: stop, stop_sequence: null }, usage: { output_tokens: 2 } }) +
    event("message_stop", { type: "message_stop" });
  const sse = (body: string, status = 200) => () => new Response(body, { status, headers: { "content-type": "text/event-stream" } });

  async function read(reply: () => Response): Promise<{ text: string; failed: boolean }> {
    const chat = new ClaudeChatModel(createLanguageModel({ apiKey: "k", fetch: stubApi([reply, reply, reply]).fetch }));
    let text = "";
    try {
      for await (const chunk of chat.stream({ question: "?", sections: [], history: [], grade: "CE2" })) text += chunk;
      return { text, failed: false };
    } catch {
      return { text, failed: true };
    }
  }

  it("a complete answer ends normally", async () => {
    expect(await read(sse(start + block + delta("Un ") + delta("verbe.") + end("end_turn")))).toEqual({ text: "Un verbe.", failed: false });
  });

  it("an error event mid-answer throws, after the text already given", async () => {
    const result = await read(sse(start + block + delta("Un ") + event("error", { type: "error", error: { type: "overloaded_error", message: "Overloaded" } })));
    expect(result).toEqual({ text: "Un ", failed: true });
  });

  it("an answer cut by the token ceiling throws: never passed off as complete", async () => {
    expect((await read(sse(start + block + delta("Un ") + end("max_tokens")))).failed).toBe(true);
  });

  it("an HTTP error throws", async () => {
    expect((await read(sse(JSON.stringify({ type: "error", error: { type: "overloaded_error", message: "x" } }), 529))).failed).toBe(true);
  });
});
