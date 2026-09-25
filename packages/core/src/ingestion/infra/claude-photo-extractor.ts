import type { LanguageModel } from "ai";
import { z } from "zod";
import type { Result } from "../../shared/index.js";
import type { ExtractionError, PhotoExtraction, PhotoExtractor } from "../domain/ports.js";
import { generateWithRetry } from "./generate-with-retry.js";

// Flat schema; constraints the model must know live in .describe() (not
// forwarded by generateObject as .min()/.max()); business invariants live
// in .refine(), so a violation goes through the single retry.
const photoExtractionSchema = z
  .object({
    markdown: z
      .string()
      .describe("Le texte de la page transcrit fidèlement en Markdown, en conservant la hiérarchie des titres (# / ##). Vide si la photo est inexploitable."),
    legible: z.boolean().describe("false si la photo est trop floue, trop sombre ou coupée pour être lue de façon fiable."),
    isCoursePage: z
      .boolean()
      .describe("false si la photo, même lisible, ne montre pas une page de leçon ou d'exercice scolaire (un jouet, une personne, une pièce, un écran...)."),
    reason: z
      .string()
      .optional()
      .describe("Si legible ou isCoursePage est false : une raison très courte, en français, par exemple « trop flou »."),
  })
  .refine((value) => !(value.legible && value.isCoursePage) || /^#{1,6} \S/m.test(value.markdown), {
    message: "Une page de cours lisible doit être transcrite avec au moins un titre Markdown (# ou ##).",
  })
  .refine((value) => (value.legible && value.isCoursePage) || (value.reason ?? "").trim().length > 0, {
    message: "Une photo inexploitable doit avoir une raison.",
  });

const PROMPT =
  "Cette photo a été prise par un enfant de l'école primaire, qui voulait photographier une page de son cours. " +
  "Transcris fidèlement le texte de la page en Markdown, en conservant la hiérarchie des titres (# / ##), sans résumer ni reformuler. " +
  "Si la photo est trop floue, trop sombre ou coupée pour être lue de façon fiable, indique legible=false et donne une raison brève. " +
  "Si elle est lisible mais ne montre pas une page de leçon ou d'exercice scolaire, indique isCoursePage=false et donne une raison brève.";

// Real adapter: never used by `pnpm test` except against stubs, exercised
// by `pnpm fixtures:record` and in production (CLAUDE.md rule 3).
export class ClaudePhotoExtractor implements PhotoExtractor {
  constructor(private readonly model: LanguageModel) {}

  async extract(input: { bytes: Uint8Array }): Promise<Result<PhotoExtraction, ExtractionError>> {
    const result = await generateWithRetry(this.model, photoExtractionSchema, (feedback) => [
      {
        role: "user",
        content: [
          { type: "image", image: input.bytes, mimeType: "image/jpeg" },
          { type: "text", text: feedback ? `${PROMPT}\n\n${feedback}` : PROMPT },
        ],
      },
    ]);
    if (!result.ok) return result;
    const { markdown, legible, isCoursePage, reason } = result.value;
    return { ok: true, value: reason === undefined ? { markdown, legible, isCoursePage } : { markdown, legible, isCoursePage, reason } };
  }
}
