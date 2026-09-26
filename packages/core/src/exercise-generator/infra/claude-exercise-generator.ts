import type { LanguageModel } from "ai";
import { z } from "zod";
import type { Grade } from "../../auth/index.js";
import { generateWithRetry } from "../../ingestion/index.js";
import type { Result } from "../../shared/index.js";
import type { GameType } from "../domain/game-types.js";
import type { ExerciseGenerator, GenerationError } from "../domain/ports.js";
import { generationPrompt } from "./prompts.js";

const item = z.number().describe("Le numéro de l'item dans la liste donnée.");

// One flat schema per game type, never a union (CLAUDE.md rule 4). No
// .refine() on an exercise: each one is checked on its own in domain/ and
// an invalid one is dropped alone (the rule's exception, decided at M3).
const EXERCISE_SCHEMAS: Record<GameType, z.ZodTypeAny> = {
  mcq: z.object({ item, question: z.string(), options: z.array(z.string()).describe("Exactement 4 options différentes."), answer: z.string().describe("L'une des 4 options, recopiée de la leçon.") }),
  true_false: z.object({ item, statement: z.string().describe("Une phrase affirmative, sans « vrai » ni « faux »."), answer: z.boolean() }),
  cloze: z.object({ item, text: z.string().describe("Une phrase de la leçon avec des trous {{0}}, {{1}}."), blanks: z.array(z.string()).describe("Les mots de la leçon, un par trou, dans l'ordre.") }),
  matching: z.object({ item, pairs: z.array(z.object({ left: z.string(), right: z.string() })).describe("3 à 6 paires de la leçon.") }),
  reordering: z.object({ item, elements: z.array(z.string()).describe("3 à 6 éléments, dans l'ordre de la leçon.") }),
  delayed_copy: z.object({ item, wordOrPhrase: z.string().describe("Un mot ou une phrase de 6 mots au plus, recopié de la leçon.") }),
  mental_math: z.object({ item, question: z.string().describe("Un calcul de la leçon, avec ses nombres."), answer: z.number() }),
};

export class ClaudeExerciseGenerator implements ExerciseGenerator {
  constructor(private readonly model: LanguageModel) {}

  async generate(input: { type: GameType; items: { title: string; body: string }[]; courseMarkdown: string; grade: Grade }): Promise<Result<unknown[], GenerationError>> {
    // The model sees the type's flat schema; an element that breaks it
    // becomes null instead of refusing the whole list, and is dropped in
    // domain/ with the other invalid ones. Only an unreadable answer as a
    // whole (no list at all) goes through the single retry.
    const schema = z.object({ exercises: z.array(EXERCISE_SCHEMAS[input.type].catch(null)).describe("Un exercice par item, au plus.") });
    const result = await generateWithRetry(this.model, schema, (feedback) => [
      { role: "user", content: `${generationPrompt(input.type, input.grade, input.courseMarkdown, input.items)}${feedback ? `\n\n${feedback}` : ""}` },
    ]);
    if (!result.ok) return { ok: false, error: { kind: "model-error", message: result.error.message } };
    return { ok: true, value: result.value.exercises };
  }
}
