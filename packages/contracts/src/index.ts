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
