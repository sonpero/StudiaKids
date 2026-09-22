import { loginErrorResponseSchema, loginRequestSchema, rateLimitedResponseSchema } from "@studiakids/contracts";
import { authenticate, type AuthenticateDeps, type Clock } from "@studiakids/core";
import type { FastifyPluginCallback } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { SESSION_COOKIE_NAME } from "../plugins/auth.js";

export interface AuthRoutesOptions {
  authenticateDeps: AuthenticateDeps;
  clock: Clock;
  cookieSecure: boolean;
  sessionMaxAgeSeconds: number;
}

export const authRoutes: FastifyPluginCallback<AuthRoutesOptions> = (app, opts, done) => {
  app.withTypeProvider<ZodTypeProvider>().post(
    "/api/auth/login",
    {
      config: { public: true },
      schema: { body: loginRequestSchema, response: { 401: loginErrorResponseSchema, 429: rateLimitedResponseSchema } },
    },
    async (request, reply) => {
      const result = await authenticate(
        opts.authenticateDeps,
        request.body.username,
        request.body.password,
        request.ip,
        opts.clock.now(),
      );

      if (!result.ok) {
        if (result.error.kind === "rate-limited") {
          return reply.code(429).header("Retry-After", String(result.error.retryAfterSeconds)).send({ error: "rate_limited" });
        }
        // Same generic body for a wrong password and for an unknown
        // username (docs/modules/auth.md): the response must never let a
        // caller guess which usernames exist.
        return reply.code(401).send({ error: "invalid_credentials" });
      }

      return reply
        .setCookie(SESSION_COOKIE_NAME, result.value.token, {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          secure: opts.cookieSecure,
          maxAge: opts.sessionMaxAgeSeconds,
        })
        .code(204)
        .send();
    },
  );

  app.post("/api/auth/logout", { config: { public: true } }, async (_request, reply) => {
    return reply.clearCookie(SESSION_COOKIE_NAME, { path: "/" }).code(204).send();
  });

  done();
};
