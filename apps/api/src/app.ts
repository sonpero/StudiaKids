import staticPlugin from "@fastify/static";
import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { openDatabase } from "./db/connection.js";
import { runMigrations } from "./db/migrate.js";
import { dbPlugin } from "./plugins/db.js";
import { healthRoutes } from "./routes/health.js";

export interface BuildAppOptions {
  databasePath: string;
  dataDir: string;
  webDistPath?: string;
}

export function buildApp(opts: BuildAppOptions) {
  const db = openDatabase(opts.databasePath);
  runMigrations(db);

  const app = Fastify({ logger: true });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  void app.register(dbPlugin, { db });
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
