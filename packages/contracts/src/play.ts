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
// After a wrong answer only: the right one, in the shape of a given answer
// (the screen shows it briefly, carried by the mascot).
const correctionSchema = z.union([
  GIVEN_ANSWER_SCHEMAS.delayed_copy,
  GIVEN_ANSWER_SCHEMAS.mcq,
  GIVEN_ANSWER_SCHEMAS.matching,
  GIVEN_ANSWER_SCHEMAS.reordering,
  GIVEN_ANSWER_SCHEMAS.cloze,
  GIVEN_ANSWER_SCHEMAS.true_false,
  GIVEN_ANSWER_SCHEMAS.mental_math,
]);
// M5 (docs/modules/progress.md): derived from the attempts, never stored.
export const progressSchema = z.object({
  total: z.number().int(),
  currentStreak: z.number().int(),
  bestStreak: z.number().int(),
  starsSince: z.number().int().optional().describe("Étoiles gagnées depuis `since` (récapitulatif de session)"),
  successesSince: z.number().int().optional().describe("Bonnes réponses depuis `since`, aidées comprises"),
});
export type ProgressDto = z.infer<typeof progressSchema>;
export const progressQuerySchema = z.object({ since: z.string().optional() });

// After every answer, so that the counter moves without a reload.
export const answerProgressSchema = z.object({
  total: z.number().int(),
  currentStreak: z.number().int(),
  bestStreak: z.number().int(),
  stars: z.number().int().describe("Étoiles gagnées par cette réponse, bonus compris"),
  celebrate: z.enum(["streak-bonus", "comeback"]).nullable().describe("La mascotte danse : bonus de série ou réussite marquante"),
});
export type AnswerProgressDto = z.infer<typeof answerProgressSchema>;

export const answerResponseSchema = z.object({ result: comparisonResultSchema, correction: correctionSchema.optional(), progress: answerProgressSchema });
export type AnswerResponseDto = z.infer<typeof answerResponseSchema>;

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
export type PlayableListDto = z.infer<typeof playableListResponseSchema>;
