export const CONTRACTS_PACKAGE = "@studiakids/contracts";

export {
  loginRequestSchema,
  type LoginRequest,
  loginErrorResponseSchema,
  type LoginErrorResponse,
  rateLimitedResponseSchema,
  type RateLimitedResponse,
  meResponseSchema,
  type MeResponse,
} from "./auth.js";

export {
  PHOTO_MAX_EDGE_PX,
  PHOTO_MAX_VISUAL_TOKENS,
  nativePhotoSize,
  type PhotoLimits,
  type PhotoSize,
} from "./photo-size.js";

export {
  courseSchema,
  type CourseDto,
  extractionStatusSchema,
  type ExtractionStatus,
  courseParamsSchema,
  pageFileParamsSchema,
  createCourseResponseSchema,
  addPageResponseSchema,
  startExtractionResponseSchema,
  courseListResponseSchema,
  unconfirmedCourseResponseSchema,
  courseErrorSchema,
  courseListItemSchema,
  type CourseListItemDto,
  type CourseError,
} from "./courses.js";

export {
  GAME_TYPES,
  gameTypeSchema,
  type GameType,
  exerciseContentSchema,
  type ExerciseContent,
  itemSchema,
  type ItemDto,
  itemListResponseSchema,
  exerciseSchema,
  type ExerciseDto,
  exerciseListResponseSchema,
  GENERATION_STATUSES,
  generationStatusSchema,
  type GenerationStatusDto,
  itemParamsSchema,
  readerTextSchema,
  type ReaderTextDto,
} from "./games.js";
export {
  GIVEN_ANSWER_SCHEMAS,
  answerRequestSchema,
  answerResponseSchema,
  comparisonResultSchema,
  exerciseParamsSchema,
  playErrorSchema,
  playableExerciseSchema,
  playableListResponseSchema,
  type AnswerRequest,
  type ComparisonResultDto,
  type GivenAnswer,
  type PlayError,
  type PlayableExerciseDto,
} from "./play.js";
