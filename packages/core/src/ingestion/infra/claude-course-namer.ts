import type { LanguageModel } from "ai";
import { z } from "zod";
import { ok, type Result } from "../../shared/index.js";
import type { CourseNamer, CourseNameSuggestion, ExtractionError } from "../domain/ports.js";
import { SUBJECTS } from "../domain/subject.js";
import { COURSE_TITLE_MAX_CHARS, COURSE_TITLE_MIN_CHARS, isValidCourseTitle, startsWithLessonCode } from "../domain/title.js";
import { generateWithRetry } from "./generate-with-retry.js";

const courseNameSchema = z.object({
  title: z
    .string()
    .describe(
      `Le titre de la leçon tel qu'il est écrit sur la page, sans code ni numéro (ni « NUM1 », ni « Leçon 3 »), ${String(COURSE_TITLE_MAX_CHARS)} caractères au plus (ex. « Revoir les nombres jusqu'à 9999 »).`,
    )
    .refine((title) => title.trim().length >= COURSE_TITLE_MIN_CHARS && title.trim().length <= COURSE_TITLE_MAX_CHARS, {
      message: `Le titre doit faire entre ${String(COURSE_TITLE_MIN_CHARS)} et ${String(COURSE_TITLE_MAX_CHARS)} caractères.`,
    })
    .refine((title) => !startsWithLessonCode(title), {
      message: "Le titre ne commence jamais par un code ou un numéro de leçon (« NUM1 – », « Leçon 3 : ») : donne seulement le titre.",
    }),
  subject: z
    .enum(SUBJECTS)
    .describe("La matière : maths, french (français), history (histoire), geography (géographie), science (sciences), english (anglais), other (autre)."),
});

const PROMPT =
  "Voici le texte d'une leçon d'école primaire. Donne le titre de la leçon tel qu'il est écrit sur la page, sans code ni numéro " +
  `(ni « NUM1 », ni « Leçon 3 »), ${String(COURSE_TITLE_MAX_CHARS)} caractères au plus, et la matière, pour qu'un enfant reconnaisse son cours. ` +
  "Le niveau scolaire ne se devine pas : il ne t'est pas demandé.";

function salvage(output: unknown): CourseNameSuggestion {
  const answer = typeof output === "object" && output !== null ? (output as { title?: unknown; subject?: unknown }) : {};
  const title = typeof answer.title === "string" && isValidCourseTitle(answer.title) ? answer.title.trim() : null;
  const subject = SUBJECTS.find((known) => known === answer.subject) ?? null;
  return { title, subject };
}

// Text only: naming never needs the photo, nor the vision model.
export class ClaudeCourseNamer implements CourseNamer {
  constructor(private readonly model: LanguageModel) {}

  async suggest(input: { markdown: string }): Promise<Result<CourseNameSuggestion, ExtractionError>> {
    const result = await generateWithRetry(this.model, courseNameSchema, (feedback) => [
      { role: "user", content: `${PROMPT}\n\n${input.markdown}${feedback ? `\n\n${feedback}` : ""}` },
    ]);
    if (result.ok) return result;
    // Naming never fails a course: after the retry, whatever field of the
    // last answer is valid is kept, the other is null (resolveCourseName).
    return ok(salvage(result.error.lastOutput));
  }
}
