import { fileURLToPath } from "node:url";
import path from "node:path";
import { buildApp } from "./app.js";
import { resolveDataDirs } from "./data-dirs.js";

const { dbDir, photosDir } = resolveDataDirs();

const isProduction = process.env.NODE_ENV === "production";
const webDistPath = fileURLToPath(new URL("../../web/dist", import.meta.url));

const app = buildApp({
  databasePath: path.join(dbDir, "studiakids.db"),
  dataDir: photosDir,
  webDistPath: isProduction ? webDistPath : undefined,
  sessionSecret: process.env.SESSION_SECRET ?? "",
  cookieSecure: process.env.COOKIE_SECURE === "true",
  sessionDurationDays: process.env.SESSION_DURATION_DAYS ? Number(process.env.SESSION_DURATION_DAYS) : undefined,
});

const port = Number(process.env.PORT ?? 3000);

app.listen({ port, host: "0.0.0.0" }).catch((err: unknown) => {
  app.log.error(err);
  process.exit(1);
});

async function shutdown(): Promise<void> {
  await app.close();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());
