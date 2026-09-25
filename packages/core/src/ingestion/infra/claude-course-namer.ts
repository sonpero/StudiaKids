import type { LanguageModel } from "ai";
import { z } from "zod";
import type { Result } from "../../shared/index.js";
import type { CourseNamer, CourseNameSuggestion, ExtractionError } from "../domain/ports.js";
import { SUBJECTS } from "../domain/subject.js";
import { generateWithRetry } from "./generate-with-retry.js";

const MAX_TITLE_WORDS = 3;

const courseNameSchema = z.object({
  title: z
    .string()
    .describe("Le titre du cours, trois mots au plus, en français, compréhensible par un enfant (ex. « Les fractions »).")
    .refine((title) => title.trim().length > 0 && title.trim().split(/\s+/).length <= MAX_TITLE_WORDS, {
      message: `Le titre doit faire entre un et ${String(MAX_TITLE_WORDS)} mots.`,
    }),
  subject: z
    .enum(SUBJECTS)
    .describe("La matière : maths, french (français), history (histoire), geography (géographie), science (sciences), english (anglais), other (autre)."),
});

const PROMPT =
  "Voici le texte d'une leçon d'école primaire. Propose un titre très court et la matière, pour qu'un enfant reconnaisse son cours. " +
  "Le niveau scolaire ne se devine pas : il ne t'est pas demandé.";

// Text only: naming never needs the photo, nor the vision model.
export class ClaudeCourseNamer implements CourseNamer {
  constructor(private readonly model: LanguageModel) {}

  suggest(input: { markdown: string }): Promise<Result<CourseNameSuggestion, ExtractionError>> {
    return generateWithRetry(this.model, courseNameSchema, (feedback) => [
      { role: "user", content: `${PROMPT}\n\n${input.markdown}${feedback ? `\n\n${feedback}` : ""}` },
    ]);
  }
}
