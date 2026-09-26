import path from "node:path";
import { deleteAccountWithPhotos } from "../account-deletion.js";
import { resolveDataDirs } from "../data-dirs.js";
import { openDatabase } from "../db/connection.js";
import { runMigrations } from "../db/migrate.js";

// CLI only, never reachable over HTTP (docs/modules/auth.md).
async function main(): Promise<void> {
  const username = process.argv[2];
  if (!username) {
    console.error("Usage: pnpm accounts:delete <username>");
    process.exit(1);
  }

  const { root, dbDir } = resolveDataDirs();
  const db = openDatabase(path.join(dbDir, "studiakids.db"));
  runMigrations(db);

  if ((await deleteAccountWithPhotos({ db, volumeRoot: root }, username)) === "not-found") {
    console.error(`Account "${username}" does not exist.`);
    process.exit(1);
  }
  console.log(`Account deleted, with its courses and photos: ${username}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
