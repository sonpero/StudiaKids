import { mkdirSync } from "node:fs";
import path from "node:path";

export interface DataDirs {
  root: string;
  dbDir: string;
  photosDir: string;
}

// Railway sets RAILWAY_VOLUME_MOUNT_PATH automatically when a volume is
// mounted — no manual env var to configure by hand in the Railway dashboard
// (unlike StudIA's own DATA_DIR, docs/inventaire-studia.md §5). One volume,
// two subfolders, created eagerly at every boot so both exist before any
// module needs them (docs/donnees.md).
export function resolveDataDirs(env: NodeJS.ProcessEnv = process.env, cwd: string = process.cwd()): DataDirs {
  const root = env.RAILWAY_VOLUME_MOUNT_PATH ?? path.resolve(cwd, "./data");
  const dbDir = path.join(root, "db");
  const photosDir = path.join(root, "photos");

  mkdirSync(dbDir, { recursive: true });
  mkdirSync(photosDir, { recursive: true });

  return { root, dbDir, photosDir };
}
