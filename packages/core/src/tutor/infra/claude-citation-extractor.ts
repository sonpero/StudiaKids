import { generateObject, type LanguageModel } from "ai";
import { z } from "zod";
import { err, ok, type Result } from "../../shared/index.js";
import type { CitationExtractor, ExtractError } from "../domain/ports.js";
import type { Section } from "../domain/split-into-sections.js";
import { citationPrompt } from "./prompts.js";

const describeError = (error: unknown) => (error instanceof Error ? error.message : String(error));

// Recopied from StudIA (docs/inventaire-studia.md, §7): citations found
// after the fact by a second, non-streamed call, never markers parsed out
// of the stream. The bounds depend on this call's sections.
export class ClaudeCitationExtractor implements CitationExtractor {
  constructor(private readonly model: LanguageModel) {}

  async extract(input: { answer: string; sections: Section[] }): Promise<Result<{ sectionIndexes: number[] }, ExtractError>> {
    const maxIndex = input.sections.length - 1;
    const schema = z.object({
      sectionIndexes: z.array(z.number().int().min(0).max(maxIndex)).describe("Numéros (à partir de 0) des sections qui soutiennent la réponse. Vide si aucune."),
    });
    const prompt = citationPrompt(input.answer, input.sections);
    const attempt = async (feedback?: string) => {
      const { object } = await generateObject({ model: this.model, schema, prompt: feedback ? `${prompt}\n\n${feedback}` : prompt });
      if (new Set(object.sectionIndexes).size !== object.sectionIndexes.length) throw new Error("une section citée deux fois");
      return object;
    };
    try {
      return ok(await attempt());
    } catch (firstError) {
      try {
        return ok(await attempt(`Ta réponse précédente n'a pas respecté le format attendu : ${describeError(firstError)}. Corrige et réessaie.`));
      } catch (secondError) {
        return err({ kind: "invalid-output", message: describeError(secondError) });
      }
    }
  }
}
