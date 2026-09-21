import { mkdirSync } from "node:fs";
import path from "node:path";

export interface DataDirs {
  root: string;
  dbDir: string;
  photosDir: string;
}

// Same bootstrapping as apps/api/src/data-dirs.ts, own small copy (same
// reasoning as db/connection.ts). Railway sets RAILWAY_VOLUME_MOUNT_PATH
// automatically when a volume is mounted. One volume, two subfolders,
// created eagerly at every boot (docs/donnees.md).
export function resolveDataDirs(env: NodeJS.ProcessEnv = process.env, cwd: string = process.cwd()): DataDirs {
  const root = env.RAILWAY_VOLUME_MOUNT_PATH ?? path.resolve(cwd, "./data");
  const dbDir = path.join(root, "db");
  const photosDir = path.join(root, "photos");

  mkdirSync(dbDir, { recursive: true });
  mkdirSync(photosDir, { recursive: true });

  return { root, dbDir, photosDir };
}
