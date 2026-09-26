import { z } from "zod";

// docs/modules/game-engine.md: the closed list, shared by
// exercise-generator (which produces the content), game-engine (which
// plays it) and the HTTP contract.
export const GAME_TYPES = ["delayed_copy", "mcq", "matching", "reordering", "cloze", "true_false", "mental_math"] as const;
export const gameTypeSchema = z.enum(GAME_TYPES);
export type GameType = z.infer<typeof gameTypeSchema>;

// The content of an exercise, per type. A discriminated union is fine in
// the HTTP contract; the model never sees it (one flat schema per type,
// docs/modules/exercise-generator.md).
export const exerciseContentSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("delayed_copy"), wordOrPhrase: z.string() }),
  z.object({ type: z.literal("mcq"), question: z.string(), options: z.array(z.string()), answer: z.string() }),
  z.object({ type: z.literal("matching"), pairs: z.array(z.object({ left: z.string(), right: z.string() })) }),
  z.object({ type: z.literal("reordering"), elements: z.array(z.string()) }),
  z.object({ type: z.literal("cloze"), text: z.string(), blanks: z.array(z.string()) }),
  z.object({ type: z.literal("true_false"), statement: z.string(), answer: z.boolean() }),
  z.object({ type: z.literal("mental_math"), question: z.string(), answer: z.number() }),
]);
export type ExerciseContent = z.infer<typeof exerciseContentSchema>;

export const itemSchema = z.object({ id: z.string(), title: z.string(), body: z.string(), gameTypes: z.array(gameTypeSchema), position: z.number().int() });
export type ItemDto = z.infer<typeof itemSchema>;
export const itemListResponseSchema = z.object({ items: z.array(itemSchema) });

export const exerciseSchema = z.object({ id: z.string(), itemId: z.string(), type: gameTypeSchema, content: exerciseContentSchema });
export type ExerciseDto = z.infer<typeof exerciseSchema>;
export const exerciseListResponseSchema = z.object({ exercises: z.array(exerciseSchema) });

export const GENERATION_STATUSES = ["not_started", "splitting", "insufficient_coverage", "generating", "ready", "failed"] as const;
export const generationStatusSchema = z.object({
  status: z.enum(GENERATION_STATUSES),
  // In game types: the generation runs one job per type.
  done: z.number().int(),
  total: z.number().int(),
  failed: z.number().int(),
  itemCount: z.number().int(),
});
export type GenerationStatusDto = z.infer<typeof generationStatusSchema>;

export const itemParamsSchema = z.object({ id: z.string() });

export const readerTextSchema = z.object({
  markdown: z.string(),
  speech: z.string().describe("Le texte lu à voix haute : le Markdown sans ses symboles"),
  photos: z.array(z.object({ index: z.number().int() })),
});
export type ReaderTextDto = z.infer<typeof readerTextSchema>;
