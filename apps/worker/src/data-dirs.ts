import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface DataDirs {
  root: string;
  dbDir: string;
  photosDir: string;
}

// Same bootstrapping as apps/api/src/data-dirs.ts, own small copy (same
// reasoning as db/connection.ts). Railway sets RAILWAY_VOLUME_MOUNT_PATH
// automatically when a volume is mounted. One volume, two subfolders,
// created eagerly at every boot (docs/donnees.md).
// The repository's data/, resolved from this file, never from the cwd:
// pnpm dev runs the API and the worker each from its own folder, and they
// must share one database and one photos folder (the CLI too).
export const DEFAULT_DATA_ROOT = fileURLToPath(new URL("../../../data", import.meta.url));

export function resolveDataDirs(env: NodeJS.ProcessEnv = process.env, localRoot: string = path.dirname(DEFAULT_DATA_ROOT)): DataDirs {
  const root = env.RAILWAY_VOLUME_MOUNT_PATH ?? path.resolve(localRoot, "./data");
  const dbDir = path.join(root, "db");
  const photosDir = path.join(root, "photos");

  mkdirSync(dbDir, { recursive: true });
  mkdirSync(photosDir, { recursive: true });

  return { root, dbDir, photosDir };
}
