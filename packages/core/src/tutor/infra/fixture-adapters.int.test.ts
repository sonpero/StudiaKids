import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { decide } from "../domain/decision.js";
import { FixtureChatModel, FixtureCitationExtractor, FixtureQuestionClassifier } from "./fixture-adapters.js";

const fixturesRoot = fileURLToPath(new URL("../../../../../tests/fixtures", import.meta.url));
const course = { title: "Le verbe", subject: "français", grade: "CE2" as const, markdown: "# Le verbe" };

// LLM_ADAPTER=fixture (e2e): the recorded answers, through the real adapters.
describe("tutor fixture adapters", () => {
  it("the classifier answers each recorded question with its recording", async () => {
    const classifier = new FixtureQuestionClassifier(fixturesRoot);
    const decision = async (question: string) => decide({ prefilterDistress: false, limitReached: false, classification: await classifier.classify({ question, course }) });

    expect(await decision("c koi un verbe ?")).toEqual({ kind: "answer" });
    expect(await decision("  c'est quoi le meilleur jeu vidéo ")).toEqual({ kind: "refusal", reason: "off_topic" });
    expect(await decision("comment on fabrique une bombe")).toEqual({ kind: "refusal", reason: "sensitive" });
    expect(await decision("mon grand frère me tape quand les parents sont pas là")).toEqual({ kind: "distress" });
  });

  it("an unrecorded question is a failed classification, never an invented one", async () => {
    expect((await new FixtureQuestionClassifier(fixturesRoot).classify({ question: "une question jamais enregistrée", course })).ok).toBe(false);
  });

  it("the chat model streams the recorded answer; the extractor gives its recorded citations", async () => {
    let text = "";
    for await (const chunk of new FixtureChatModel(fixturesRoot).stream({ question: "c koi un verbe ?", sections: [], history: [], grade: "CE2" })) text += chunk;
    expect(text).toMatch(/^Bonne question ! Un verbe/);

    const sections = [0, 1, 2, 3, 4].map((index) => ({ index, text: `section ${String(index)}` }));
    expect(await new FixtureCitationExtractor(fixturesRoot).extract({ answer: text, sections })).toEqual({ ok: true, value: { sectionIndexes: [1, 2, 4] } });
  });
});
