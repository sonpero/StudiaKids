import path from "node:path";
import {
  EXTRACT_COURSE_JOB,
  extractCourseJobHandler,
  LocalFileStore,
  runWorkerLoop,
  SqliteCourseRepository,
  SqliteJobQueue,
  systemClock,
  uuidV7Generator,
  type JobHandler,
} from "@studiakids/core";
import { openDatabase } from "./db/connection.js";
import { runMigrations } from "./db/migrate.js";
import { resolveDataDirs } from "./data-dirs.js";
import { selectModelAdapters } from "./model-adapters.js";

const { root, dbDir } = resolveDataDirs();

const db = openDatabase(path.join(dbDir, "studiakids.db"));
runMigrations(db);

// Handlers register at startup (docs/modules/jobs.md). The file store gets
// the volume root: it adds photos/ itself, like the API's.
const handlers = new Map<string, JobHandler>([
  [EXTRACT_COURSE_JOB, extractCourseJobHandler({ repo: new SqliteCourseRepository(db), fileStore: new LocalFileStore(root), ...selectModelAdapters(process.env) })],
]);

const signal = { stopped: false };
console.log(`[worker] started, handling: ${[...handlers.keys()].join(", ")}`);
void runWorkerLoop({ jobQueue: new SqliteJobQueue(db, uuidV7Generator), handlers, clock: systemClock }, signal).catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

function shutdown(signalName: string): void {
  console.log(`[worker] ${signalName} received, exiting`);
  signal.stopped = true;
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
