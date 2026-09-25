import { describe, expect, it } from "vitest";
import { createLanguageModel } from "../../shared/index.js";
import { ClaudeCourseNamer } from "./claude-course-namer.js";
import { ClaudePhotoExtractor } from "./claude-photo-extractor.js";

// Minimal stand-ins for the Messages API, to test the adapters' own logic
// (request shape, single retry). Not LLM fixtures: the recorded responses
// the contract tests replay come from `pnpm fixtures:record`.
function stubApi(toolInputs: unknown[]): { fetch: typeof fetch; requests: Record<string, unknown>[] } {
  const requests: Record<string, unknown>[] = [];
  const stub = (_input: Parameters<typeof fetch>[0], init?: RequestInit): Promise<Response> => {
    if (typeof init?.body !== "string") throw new Error("expected a JSON body");
    requests.push(JSON.parse(init.body) as Record<string, unknown>);
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
  return { fetch: stub, requests };
}

const photo = Uint8Array.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x03, 0x00, 0xff, 0xd9]);
const lastUserText = (request: Record<string, unknown>) => JSON.stringify(request.messages);

describe("ClaudePhotoExtractor", () => {
  it("sends the photo as a JPEG image and forces the structured answer", async () => {
    const api = stubApi([{ markdown: "# Les fractions\n\nUne moitié.", legible: true, isCoursePage: true }]);
    const extractor = new ClaudePhotoExtractor(createLanguageModel({ apiKey: "k", fetch: api.fetch }));

    const result = await extractor.extract({ bytes: photo });

    expect(result).toEqual({ ok: true, value: { markdown: "# Les fractions\n\nUne moitié.", legible: true, isCoursePage: true } });
    expect(api.requests).toHaveLength(1);
    expect(api.requests[0]).toMatchObject({ tool_choice: { type: "tool", name: "json" } });
    expect(lastUserText(api.requests[0]!)).toContain(`"media_type":"image/jpeg","data":"${Buffer.from(photo).toString("base64")}"`);
  });

  it("returns an illegible photo as a normal result, with its reason", async () => {
    const api = stubApi([{ markdown: "", legible: false, isCoursePage: false, reason: "trop flou" }]);
    const extractor = new ClaudePhotoExtractor(createLanguageModel({ apiKey: "k", fetch: api.fetch }));

    expect(await extractor.extract({ bytes: photo })).toEqual({ ok: true, value: { markdown: "", legible: false, isCoursePage: false, reason: "trop flou" } });
  });

  // docs/modules/ingestion.md: an extractor returning flat text has failed,
  // even though it returned text.
  it("treats flat text without any heading as invalid: exactly one retry, with the error fed back", async () => {
    const api = stubApi([
      { markdown: "Les fractions. Une moitié.", legible: true, isCoursePage: true },
      { markdown: "# Les fractions\n\nUne moitié.", legible: true, isCoursePage: true },
    ]);
    const extractor = new ClaudePhotoExtractor(createLanguageModel({ apiKey: "k", fetch: api.fetch }));

    const result = await extractor.extract({ bytes: photo });

    expect(result.ok).toBe(true);
    expect(api.requests).toHaveLength(2);
    expect(lastUserText(api.requests[1]!)).toContain("n'a pas respecté le format attendu");
  });

  it("fails after the single retry, never a third call", async () => {
    const api = stubApi([{ legible: "yes" }, { legible: "still no" }, { markdown: "# never asked", legible: true, isCoursePage: true }]);
    const extractor = new ClaudePhotoExtractor(createLanguageModel({ apiKey: "k", fetch: api.fetch }));

    const result = await extractor.extract({ bytes: photo });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.kind).toBe("model-error");
    expect(api.requests).toHaveLength(2);
  });

  it("requires a reason when the photo cannot be used", async () => {
    const api = stubApi([{ markdown: "", legible: false, isCoursePage: false }, { markdown: "", legible: false, isCoursePage: false }]);
    const extractor = new ClaudePhotoExtractor(createLanguageModel({ apiKey: "k", fetch: api.fetch }));

    expect((await extractor.extract({ bytes: photo })).ok).toBe(false);
  });
});

describe("ClaudeCourseNamer", () => {
  it("proposes a short title and a subject from the closed list, from the text only", async () => {
    const api = stubApi([{ title: "Les fractions", subject: "maths" }]);
    const namer = new ClaudeCourseNamer(createLanguageModel({ apiKey: "k", fetch: api.fetch }));

    expect(await namer.suggest({ markdown: "# Les fractions" })).toEqual({ ok: true, value: { title: "Les fractions", subject: "maths" } });
    expect(lastUserText(api.requests[0]!)).not.toContain("image");
  });

  it("rejects a title over three words or a subject outside the list, then retries once", async () => {
    const api = stubApi([
      { title: "Les fractions et les décimaux", subject: "maths" },
      { title: "Fractions", subject: "mathematics" },
    ]);
    const namer = new ClaudeCourseNamer(createLanguageModel({ apiKey: "k", fetch: api.fetch }));

    expect((await namer.suggest({ markdown: "# Les fractions" })).ok).toBe(false);
    expect(api.requests).toHaveLength(2);
  });
});
