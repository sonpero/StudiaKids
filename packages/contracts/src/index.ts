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
  type CourseError,
} from "./courses.js";
