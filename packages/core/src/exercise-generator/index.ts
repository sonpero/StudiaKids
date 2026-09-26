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
