import { ClaudeChatModel, ClaudeQuestionClassifier, FixtureChatModel, FixtureCitationExtractor, FixtureQuestionClassifier } from "@studiakids/core";
import { describe, expect, it } from "vitest";
import { selectTutorModels } from "./tutor-models.js";

const course = { title: "Le verbe", subject: "français", grade: "CE2" as const, markdown: "# Le verbe" };

function recordingFetch() {
  const bodies: Record<string, unknown>[] = [];
  const fetch = (_input: Parameters<typeof globalThis.fetch>[0], init?: RequestInit): Promise<Response> => {
    bodies.push(JSON.parse(typeof init?.body === "string" ? init.body : "{}") as Record<string, unknown>);
    return Promise.resolve(new Response(JSON.stringify({ type: "error", error: { type: "overloaded_error", message: "x" } }), { status: 400 }));
  };
  return { fetch, bodies };
}

describe("selectTutorModels", () => {
  it("LLM_ADAPTER=fixture: the recorded tutor, no API key needed", () => {
    const models = selectTutorModels({ LLM_ADAPTER: "fixture" });

    expect(models.classifier).toBeInstanceOf(FixtureQuestionClassifier);
    expect(models.chat).toBeInstanceOf(FixtureChatModel);
    expect(models.citations).toBeInstanceOf(FixtureCitationExtractor);
  });

  it("an unknown LLM_ADAPTER value is refused, never silently treated as real", () => {
    expect(() => selectTutorModels({ LLM_ADAPTER: "fixtures" })).toThrow(/LLM_ADAPTER/);
  });

  // M6: the classifier model chosen on the golden set, overridable; the
  // answer's ceiling set where the factory applies it.
  it("otherwise: the classifier on CLASSIFIER_MODEL (claude-sonnet-5 by default), the answer capped at 600 tokens", async () => {
    const byDefault = recordingFetch();
    const models = selectTutorModels({ ANTHROPIC_API_KEY: "sk-test" }, byDefault.fetch);
    expect(models.classifier).toBeInstanceOf(ClaudeQuestionClassifier);
    expect(models.chat).toBeInstanceOf(ClaudeChatModel);

    await models.classifier.classify({ question: "?", course });
    try {
      for await (const _chunk of models.chat.stream({ question: "?", sections: [], history: [], grade: "CE2" })) break;
    } catch {
      // the stub refuses: only the requests matter
    }
    expect(byDefault.bodies[0]?.model).toBe("claude-sonnet-5");
    expect(byDefault.bodies.at(-1)).toMatchObject({ stream: true, max_tokens: 600 });

    const chosen = recordingFetch();
    await selectTutorModels({ ANTHROPIC_API_KEY: "sk-test", CLASSIFIER_MODEL: "claude-haiku-4-5-20251001" }, chosen.fetch).classifier.classify({ question: "?", course });
    expect(chosen.bodies[0]?.model).toBe("claude-haiku-4-5-20251001");
  });
});
