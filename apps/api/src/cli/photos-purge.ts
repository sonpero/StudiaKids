import path from "node:path";
import { resolveDataDirs } from "../data-dirs.js";
import { openDatabase } from "../db/connection.js";
import { runMigrations } from "../db/migrate.js";
import { purgeConfirmedCoursePhotos } from "../photos-purge.js";

// CLI only (docs/securite.md, 2026-10-04): removes the photos confirmed
// courses still have. --dry-run counts them without removing anything.
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  if (args.some((arg) => arg !== "--dry-run")) {
    console.error("Usage: pnpm photos:purge [--dry-run]");
    process.exit(1);
  }

  const { root, dbDir } = resolveDataDirs();
  const db = openDatabase(path.join(dbDir, "studiakids.db"));
  runMigrations(db);

  const { courses, files, bytes } = await purgeConfirmedCoursePhotos({ db, volumeRoot: root }, { dryRun });
  const megabytes = (bytes / 1_000_000).toFixed(1);
  console.log(dryRun ? `[dry run] would remove ${String(files)} photo file(s) from ${String(courses)} confirmed course(s), freeing ${megabytes} MB (${String(bytes)} bytes).` : `Removed ${String(files)} photo file(s) from ${String(courses)} confirmed course(s), freeing ${megabytes} MB (${String(bytes)} bytes).`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
