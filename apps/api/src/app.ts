import cookie from "@fastify/cookie";
import staticPlugin from "@fastify/static";
import { systemClock } from "@studiakids/core";
import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { buildAuthDeps } from "./auth-deps.js";
import { openDatabase } from "./db/connection.js";
import { runMigrations } from "./db/migrate.js";
import { authPlugin } from "./plugins/auth.js";
import { dbPlugin } from "./plugins/db.js";
import { authRoutes } from "./routes/auth.js";
import { healthRoutes } from "./routes/health.js";
import { meRoutes } from "./routes/me.js";

export interface BuildAppOptions {
  databasePath: string;
  dataDir: string;
  webDistPath?: string;
  sessionSecret: string;
  cookieSecure: boolean;
  sessionDurationDays?: number;
}

const DEFAULT_SESSION_DURATION_DAYS = 365;

export function buildApp(opts: BuildAppOptions) {
  if (!opts.sessionSecret) {
    throw new Error("SESSION_SECRET must be set (see CLAUDE.md and docs/modules/auth.md). Refusing to start without it.");
  }

  const sessionDurationDays = opts.sessionDurationDays ?? DEFAULT_SESSION_DURATION_DAYS;
  const sessionMaxAgeSeconds = sessionDurationDays * 24 * 60 * 60;

  const db = openDatabase(opts.databasePath);
  runMigrations(db);
  const authDeps = buildAuthDeps(db, opts.sessionSecret, sessionDurationDays);

  const app = Fastify({ logger: true });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  void app.register(cookie);
  void app.register(dbPlugin, { db });
  // Registered directly on the root app (not nested in another plugin) and
  // wrapped in fastify-plugin: its requireAuth decorator and its onRequest
  // hook are therefore visible fastify-wide, to every route registered
  // anywhere in the tree, including ones registered after this call.
  void app.register(authPlugin, {
    sessionCodec: authDeps.sessionCodec,
    accountRepository: authDeps.accountRepository,
    clock: systemClock,
    cookieSecure: opts.cookieSecure,
    sessionMaxAgeSeconds,
  });
  void app.register(authRoutes, {
    authenticateDeps: authDeps.authenticateDeps,
    clock: systemClock,
    cookieSecure: opts.cookieSecure,
    sessionMaxAgeSeconds,
  });
  void app.register(meRoutes);
  void app.register(healthRoutes);

  if (opts.webDistPath) {
    void app.register(staticPlugin, {
      root: opts.webDistPath,
      wildcard: false,
    });
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith("/api/")) {
        void reply.code(404).send({ error: "not_found" });
        return;
      }
      void reply.sendFile("index.html");
    });
  }

  return app;
}
