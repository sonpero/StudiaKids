import { z } from "zod";

export const loginRequestSchema = z.object({
  username: z.string().min(1).describe("Identifiant du compte"),
  password: z.string().min(1).describe("Mot de passe du compte"),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

// A single generic shape, used identically whether the username is unknown
// or the password is wrong — the response body must never let a caller
// guess which usernames exist (docs/modules/auth.md).
export const loginErrorResponseSchema = z.object({
  error: z.literal("invalid_credentials"),
});
export type LoginErrorResponse = z.infer<typeof loginErrorResponseSchema>;

export const rateLimitedResponseSchema = z.object({
  error: z.literal("rate_limited"),
});
export type RateLimitedResponse = z.infer<typeof rateLimitedResponseSchema>;

export const meResponseSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  grade: z.enum(["CP", "CE1", "CE2", "CM1", "CM2", "6e"]),
});
export type MeResponse = z.infer<typeof meResponseSchema>;
