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

// Decided before commit 7 of M2 (docs/modules/ingestion.md), after a real
// dry run: the page header (subject, lesson number) came out as a second
// `#`, and visual bullets as « – » lines that are not Markdown lists. Both
// break the reader's rendering and the splitting of M3.
describe("ClaudePhotoExtractor, Markdown shape", () => {
  const extractorFor = (inputs: unknown[]) => {
    const api = stubApi(inputs);
    return { api, extractor: new ClaudePhotoExtractor(createLanguageModel({ apiKey: "k", fetch: api.fetch })) };
  };
  const page = (markdown: string) => ({ markdown, legible: true, isCoursePage: true });
  const clean = "# Le verbe\n\nCahier de Léa, leçon 3\n\n## 1. À quoi sert le verbe ?\n\n- chante est le verbe ;\n- Léa est le sujet.\n\n1. chanter\n2. finir";

  it("asks for the lesson title as the only # heading, the page header as plain text, and lists as « - » or « 1. »", async () => {
    const { api, extractor } = extractorFor([page(clean)]);

    await extractor.extract({ bytes: photo });

    const prompt = lastUserText(api.requests[0]!);
    expect(prompt).toMatch(/en-tête de la page/);
    expect(prompt).toMatch(/seul titre #/);
    expect(prompt).toMatch(/« - » ou « 1\. »/);
  });

  it("accepts one # heading, ## sections, « - » and « 1. » lists on the first call", async () => {
    const { api, extractor } = extractorFor([page(clean)]);

    expect(await extractor.extract({ bytes: photo })).toEqual({ ok: true, value: page(clean) });
    expect(api.requests).toHaveLength(1);
  });

  it("the page header as a second # heading triggers the single retry, with the rule fed back", async () => {
    const { api, extractor } = extractorFor([page("# Français – Leçon 3\n\n# Le verbe\n\n## 1. Définition\n\nTexte."), page(clean)]);

    const result = await extractor.extract({ bytes: photo });

    expect(result).toEqual({ ok: true, value: page(clean) });
    expect(api.requests).toHaveLength(2);
    expect(lastUserText(api.requests[1]!)).toMatch(/un seul titre #/i);
  });

  for (const bullet of ["–", "—", "•", "·", "●"]) {
    it(`a « ${bullet} » bullet line (not a Markdown list) triggers the single retry`, async () => {
      const { api, extractor } = extractorFor([page(`# Le verbe\n\nDans la phrase :\n ${bullet} chante est le verbe ;\n ${bullet} Léa est le sujet.`), page(clean)]);

      const result = await extractor.extract({ bytes: photo });

      expect(result.ok).toBe(true);
      expect(api.requests).toHaveLength(2);
      expect(lastUserText(api.requests[1]!)).toMatch(/listes Markdown/);
    });
  }

  it("a dash inside a sentence or a heading is not a bullet", async () => {
    const markdown = "# Français – Leçon 3 : le verbe\n\nLe verbe – c'est important – change avec le temps.";
    const { api, extractor } = extractorFor([page(markdown)]);

    expect(await extractor.extract({ bytes: photo })).toEqual({ ok: true, value: page(markdown) });
    expect(api.requests).toHaveLength(1);
  });

  it("an unusable photo is never held to the Markdown rules", async () => {
    const { api, extractor } = extractorFor([{ markdown: "# A\n# B\n – x", legible: false, isCoursePage: false, reason: "trop flou" }]);

    expect((await extractor.extract({ bytes: photo })).ok).toBe(true);
    expect(api.requests).toHaveLength(1);
  });
});
