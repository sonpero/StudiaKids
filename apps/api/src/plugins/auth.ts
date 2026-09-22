import fp from "fastify-plugin";
import type { FastifyPluginCallback, FastifyReply, FastifyRequest } from "fastify";
import { resolveSession, type Account, type AccountRepository, type Clock, type SessionCodec } from "@studiakids/core";

export const SESSION_COOKIE_NAME = "studiakids_session";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

declare module "fastify" {
  interface FastifyInstance {
    requireAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    user?: Account;
  }
  interface FastifyContextConfig {
    // Opts a route out of the global requireAuth hook (default-deny below).
    public?: boolean;
  }
}

export interface AuthPluginOptions {
  sessionCodec: SessionCodec;
  accountRepository: AccountRepository;
  clock: Clock;
  cookieSecure: boolean;
  sessionMaxAgeSeconds: number;
}

function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const separatorIndex = part.indexOf("=");
    if (separatorIndex === -1) continue;
    const key = part.slice(0, separatorIndex).trim();
    if (key === name) return decodeURIComponent(part.slice(separatorIndex + 1).trim());
  }
  return undefined;
}

function hasMismatchedOrigin(request: FastifyRequest): boolean {
  const origin = request.headers.origin;
  if (!origin) return false;
  try {
    return new URL(origin).host !== request.headers.host;
  } catch {
    return true;
  }
}

const plugin: FastifyPluginCallback<AuthPluginOptions> = (app, opts, done) => {
  const requireAuth = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const token = readCookie(request.headers.cookie, SESSION_COOKIE_NAME);
    if (!token) {
      await reply.code(401).send({ error: "unauthenticated" });
      return;
    }

    const result = await resolveSession(
      { sessionCodec: opts.sessionCodec, accountRepository: opts.accountRepository },
      token,
      opts.clock.now(),
    );
    if (!result.ok) {
      await reply.code(401).send({ error: "unauthenticated" });
      return;
    }

    request.user = result.value.account;
    // Sliding session (docs/modules/auth.md): every successful authenticated
    // request re-issues the cookie with a fresh expiry.
    void reply.setCookie(SESSION_COOKIE_NAME, result.value.token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: opts.cookieSecure,
      maxAge: opts.sessionMaxAgeSeconds,
    });
  };

  app.decorate("requireAuth", requireAuth);

  // Default-deny: this hook is registered on the root app (see app.ts), so
  // fastify-plugin makes both the decorator and this hook visible to every
  // plugin/route registered anywhere in the encapsulation tree. A new route
  // is protected unless it opts out via `config: { public: true }`.
  app.addHook("onRequest", async (request, reply) => {
    if (!request.url.startsWith("/api/")) return;

    if (MUTATING_METHODS.has(request.method) && hasMismatchedOrigin(request)) {
      await reply.code(403).send({ error: "bad_origin" });
      return;
    }

    if (request.routeOptions.config?.public) return;

    await app.requireAuth(request, reply);
  });

  done();
};

export const authPlugin = fp(plugin);
