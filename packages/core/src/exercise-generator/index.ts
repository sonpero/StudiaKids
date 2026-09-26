export { GAME_TYPES, isGameType, type GameType } from "./domain/game-types.js";
export {
  COVERAGE_MIN_ITEMS,
  COVERAGE_MAX_ITEMS,
  ITEM_MAX_GAME_TYPES,
  coverageOutcome,
  validItems,
  type ItemProposal,
  type ValidItem,
  type SplitOutcome,
} from "./domain/items.js";
export { parseExercise, type ExerciseContent, type ParsedExercise } from "./domain/exercises.js";
export { anchoringProblem, normalize } from "./domain/anchoring.js";
export { needsRegeneration } from "./domain/regeneration.js";
export { generationStatus, type GenerationStatus, type GenerationProgress } from "./domain/generation-status.js";
export type { Item, Exercise, ItemSplitter, ExerciseGenerator, CourseTextSource, ItemRepository, GenerationError } from "./domain/ports.js";

export { startGeneration, type StartGenerationDeps } from "./application/start-generation.js";
export { handleSplittingJob, type HandleSplittingJobDeps } from "./application/handle-splitting-job.js";
export { handleGenerationJob, type HandleGenerationJobDeps } from "./application/handle-generation-job.js";
export { getGenerationStatus, type GetGenerationStatusDeps } from "./application/get-generation-status.js";
export { regenerateItem, type RegenerateItemDeps } from "./application/regenerate-item.js";
export { splitItemsJobHandler, generateExercisesJobHandler } from "./application/job-handlers.js";
export { SPLIT_ITEMS_JOB, GENERATE_EXERCISES_JOB, type SplitItemsPayload, type GenerateExercisesPayload } from "./application/jobs.js";

export { SqliteItemRepository, type ExerciseGeneratorDb } from "./infra/sqlite-item-repository.js";
export { ClaudeItemSplitter } from "./infra/claude-item-splitter.js";
export { ClaudeExerciseGenerator } from "./infra/claude-exercise-generator.js";
export { PROMPTS_VERSION, splitPrompt, generationPrompt, ANCHORING_RULE } from "./infra/prompts.js";
// Exported alongside the other modules' tables (drizzle-kit itself reads
// infra/schema.ts by glob).
export { itemsTable, exercisesTable, courseGenerationsTable } from "./infra/schema.js";
