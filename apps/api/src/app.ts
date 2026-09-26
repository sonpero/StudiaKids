import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import staticPlugin from "@fastify/static";
import {
  IngestionCourseTexts,
  LocalFileStore,
  MAX_PAGE_BYTES,
  SqliteCourseRepository,
  SqliteItemRepository,
  SqliteJobQueue,
  systemClock,
  uuidV7Generator,
} from "@studiakids/core";
import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { buildAuthDeps } from "./auth-deps.js";
import { openDatabase } from "./db/connection.js";
import { runMigrations } from "./db/migrate.js";
import { authPlugin } from "./plugins/auth.js";
import { dbPlugin } from "./plugins/db.js";
import { authRoutes } from "./routes/auth.js";
import { courseRoutes } from "./routes/courses.js";
import { generationRoutes } from "./routes/generation.js";
import { healthRoutes } from "./routes/health.js";
import { meRoutes } from "./routes/me.js";
import { readerRoutes } from "./routes/reader.js";

export interface BuildAppOptions {
  databasePath: string;
  // The volume root (photos/ lives under it), never photos/ itself.
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
  // One photo per request, capped at the Claude API's per-image limit:
  // anything bigger is refused while streaming, before addPage runs.
  void app.register(multipart, { limits: { fileSize: MAX_PAGE_BYTES, files: 1 } });
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
  const courseRepository = new SqliteCourseRepository(db);
  const itemRepository = new SqliteItemRepository(db);
  const jobQueue = new SqliteJobQueue(db, uuidV7Generator);
  void app.register(courseRoutes, {
    repo: courseRepository,
    itemRepo: itemRepository,
    fileStore: new LocalFileStore(opts.dataDir),
    jobQueue,
    idGenerator: uuidV7Generator,
    clock: systemClock,
  });
  void app.register(readerRoutes, { repo: courseRepository, clock: systemClock });
  void app.register(generationRoutes, { courses: new IngestionCourseTexts(courseRepository), repo: itemRepository, jobQueue, clock: systemClock });
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
