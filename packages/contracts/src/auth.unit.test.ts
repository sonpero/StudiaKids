import { describe, expect, it } from "vitest";
import { loginErrorResponseSchema, loginRequestSchema, meResponseSchema, rateLimitedResponseSchema } from "./auth.js";

describe("loginRequestSchema", () => {
  it("accepts a username and password", () => {
    expect(loginRequestSchema.safeParse({ username: "alex", password: "s3cret" }).success).toBe(true);
  });

  it("rejects an empty username or password", () => {
    expect(loginRequestSchema.safeParse({ username: "", password: "s3cret" }).success).toBe(false);
    expect(loginRequestSchema.safeParse({ username: "alex", password: "" }).success).toBe(false);
  });

  it("rejects a missing field", () => {
    expect(loginRequestSchema.safeParse({ username: "alex" }).success).toBe(false);
  });
});

describe("loginErrorResponseSchema", () => {
  // docs/modules/auth.md: an unknown username and a wrong password must be
  // indistinguishable to the caller — one generic error shape for both, so
  // the response body itself can never be used to guess valid usernames.
  it("has exactly one shape, used identically whether the username exists or not", () => {
    const unknownUsernameCase = loginErrorResponseSchema.safeParse({ error: "invalid_credentials" });
    const wrongPasswordCase = loginErrorResponseSchema.safeParse({ error: "invalid_credentials" });

    expect(unknownUsernameCase).toEqual(wrongPasswordCase);
    expect(unknownUsernameCase.success).toBe(true);
  });

  it("rejects any other error code", () => {
    expect(loginErrorResponseSchema.safeParse({ error: "unknown_username" }).success).toBe(false);
  });
});

describe("rateLimitedResponseSchema", () => {
  it("accepts the rate_limited error code", () => {
    expect(rateLimitedResponseSchema.safeParse({ error: "rate_limited" }).success).toBe(true);
  });

  it("rejects any other error code", () => {
    expect(rateLimitedResponseSchema.safeParse({ error: "invalid_credentials" }).success).toBe(false);
  });
});

describe("meResponseSchema", () => {
  it("accepts an id, firstName and grade", () => {
    expect(meResponseSchema.safeParse({ id: "u1", firstName: "Alex", grade: "CP" }).success).toBe(true);
  });

  it("rejects a missing field", () => {
    expect(meResponseSchema.safeParse({ id: "u1" }).success).toBe(false);
  });

  it("rejects an invalid grade", () => {
    expect(meResponseSchema.safeParse({ id: "u1", firstName: "Alex", grade: "CM3" }).success).toBe(false);
  });

  it("strips technical fields such as sessionVersion, never exposing them", () => {
    const result = meResponseSchema.safeParse({ id: "u1", firstName: "Alex", grade: "CP", sessionVersion: 1, passwordHash: "x" });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual({ id: "u1", firstName: "Alex", grade: "CP" });
  });
});
