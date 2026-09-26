import { spawn } from "node:child_process";
import { openSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { E2E_DATA_DIR } from "./env.js";

const workerDir = fileURLToPath(new URL("../../apps/worker", import.meta.url));

// Decided at M2 (docs/modules/ingestion.md, "Tests clés"): the real worker
// process, with the fixture adapters, on the API's own volume. A webServer
// entry would need a health URL the worker does not have. Its output goes
// to a log file next to the e2e database, for debugging a failed run.
export function startWorker(): () => void {
  const log = openSync(path.join(E2E_DATA_DIR, "worker.log"), "a");
  const worker = spawn(path.join(workerDir, "node_modules/.bin/tsx"), ["src/index.ts"], {
    cwd: workerDir,
    env: { PATH: process.env.PATH, RAILWAY_VOLUME_MOUNT_PATH: E2E_DATA_DIR, LLM_ADAPTER: "fixture" },
    stdio: ["ignore", log, log],
  });
  return () => {
    worker.kill("SIGTERM");
  };
}
