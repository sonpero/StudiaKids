import { z } from "zod";
import type { GameType } from "./games.js";

// docs/modules/game-engine.md (M4). What the child gives, per game type:
// validated here, compared on the server, never stored.
export const GIVEN_ANSWER_SCHEMAS = {
  delayed_copy: z.object({ text: z.string() }),
  mcq: z.object({ chosenOption: z.string() }),
  matching: z.object({ pairs: z.array(z.object({ left: z.string(), right: z.string() })) }),
  reordering: z.object({ order: z.array(z.string()) }),
  cloze: z.object({ values: z.array(z.string()) }),
  true_false: z.object({ value: z.boolean() }),
  mental_math: z.object({ value: z.string() }),
} satisfies Record<GameType, z.ZodTypeAny>;
export type GivenAnswer = { [T in GameType]: z.infer<(typeof GIVEN_ANSWER_SCHEMAS)[T]> };

// The answer's shape depends on the exercise's type, known only on the
// server: it is checked there against GIVEN_ANSWER_SCHEMAS.
export const answerRequestSchema = z.object({ givenAnswer: z.unknown(), reread: z.boolean().optional() });
export type AnswerRequest = z.infer<typeof answerRequestSchema>;

export const comparisonResultSchema = z.object({ units: z.array(z.object({ id: z.string(), correct: z.boolean() })) });
export type ComparisonResultDto = z.infer<typeof comparisonResultSchema>;
export const answerResponseSchema = z.object({ result: comparisonResultSchema });

export const exerciseParamsSchema = z.object({ id: z.string() });

export const playErrorSchema = z.object({ error: z.enum(["not_found", "invalid_answer"]) });
export type PlayError = z.infer<typeof playErrorSchema>["error"];

// What the Jouer screen shows: never the answer (the object schemas strip
// any extra key), columns and elements already shuffled by the server.
const base = { id: z.string(), itemTitle: z.string() };
export const playableExerciseSchema = z.discriminatedUnion("type", [
  z.object({ ...base, type: z.literal("delayed_copy"), wordOrPhrase: z.string(), displayDurationMs: z.number().int() }),
  z.object({ ...base, type: z.literal("mcq"), question: z.string(), options: z.array(z.string()) }),
  z.object({ ...base, type: z.literal("matching"), lefts: z.array(z.string()), rights: z.array(z.string()) }),
  z.object({ ...base, type: z.literal("reordering"), elements: z.array(z.string()) }),
  z.object({ ...base, type: z.literal("cloze"), text: z.string().describe("Avec des marqueurs {{0}}, {{1}}…"), blankCount: z.number().int() }),
  z.object({ ...base, type: z.literal("true_false"), statement: z.string() }),
  z.object({ ...base, type: z.literal("mental_math"), question: z.string() }),
]);
export type PlayableExerciseDto = z.infer<typeof playableExerciseSchema>;

export const playableListResponseSchema = z.object({
  exercises: z.array(playableExerciseSchema),
  nextExerciseId: z.string().nullable().describe("Le prochain exercice conseillé, null sans exercice"),
});
