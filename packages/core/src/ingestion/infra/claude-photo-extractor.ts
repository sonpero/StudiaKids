import type { LanguageModel } from "ai";
import { z } from "zod";
import type { Result } from "../../shared/index.js";
import type { ExtractionError, PhotoExtraction, PhotoExtractor } from "../domain/ports.js";
import { generateWithRetry } from "./generate-with-retry.js";

// A line opening with a typographic bullet: what a notebook's list looks
// like, but not a Markdown list (a renderer merges it into a paragraph).
const VISUAL_BULLET = /^[ \t]*[–—•·●][ \t]/m;

// Flat schema; constraints the model must know live in .describe() (not
// forwarded by generateObject as .min()/.max()); business invariants live
// in .refine(), so a violation goes through the single retry.
const photoExtractionSchema = z
  .object({
    markdown: z
      .string()
      .describe(
        "Le texte de la page transcrit fidèlement en Markdown. Un seul titre # : le titre de la leçon ; les parties en ##. " +
          "L'en-tête de la page (matière, numéro de leçon, date) en texte simple, jamais en titre. " +
          "Les énumérations en listes Markdown « - » ou « 1. ». Vide si la photo est inexploitable.",
      ),
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
  })
  .refine((value) => !(value.legible && value.isCoursePage) || (value.markdown.match(/^# /gm) ?? []).length <= 1, {
    message: "Un seul titre # : le titre de la leçon. L'en-tête de la page (matière, numéro de leçon, date) s'écrit en texte simple, jamais en titre.",
  })
  .refine((value) => !(value.legible && value.isCoursePage) || !VISUAL_BULLET.test(value.markdown), {
    message: "Les énumérations s'écrivent en listes Markdown, « - » ou « 1. » en début de ligne, jamais avec « – », « — », « • », « · » ou « ● ».",
  });

const PROMPT =
  "Cette photo a été prise par un enfant de l'école primaire, qui voulait photographier une page de son cours. " +
  "Transcris fidèlement le texte de la page en Markdown, en conservant la hiérarchie des titres, sans résumer ni reformuler. " +
  "Le seul titre # est le titre de la leçon ; ses parties sont en ##. " +
  "L'en-tête de la page (matière, numéro de leçon, date) n'est jamais un titre : écris-le en texte simple. " +
  "Toute énumération (tirets, puces, numéros) devient une liste Markdown, « - » ou « 1. » en début de ligne. " +
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
