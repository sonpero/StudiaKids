import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { openDatabase } from "./db/connection.js";
import { runMigrations } from "./db/migrate.js";

const dataDir = process.env.DATA_DIR ?? path.resolve(process.cwd(), ".data");
if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

const db = openDatabase(path.join(dataDir, "studiakids.db"));
runMigrations(db);

// No job type exists yet (M0: no business module has shipped a job
// producer). The queue-draining loop itself belongs to the `jobs` module
// (packages/core/src/jobs/, frozen once written — CLAUDE.md) and replaces
// this placeholder interval once the first module needs it. The interval's
// only purpose for now is keeping the process alive, the same role the real
// polling loop will have.
console.log("[worker] started, no job handlers registered yet");
const heartbeat = setInterval(() => undefined, 60_000);

function shutdown(signal: string): void {
  console.log(`[worker] ${signal} received, exiting`);
  clearInterval(heartbeat);
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
