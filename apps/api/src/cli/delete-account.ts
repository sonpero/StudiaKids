import path from "node:path";
import { deleteAccount, SqliteAccountRepository } from "@studiakids/core";
import { resolveDataDirs } from "../data-dirs.js";
import { openDatabase } from "../db/connection.js";
import { runMigrations } from "../db/migrate.js";

// CLI only, never reachable over HTTP (docs/modules/auth.md). At M1 this
// only removes the accounts row: no other table references userId yet, so
// there is nothing else to cascade (see delete-account.ts in packages/core).
async function main(): Promise<void> {
  const username = process.argv[2];
  if (!username) {
    console.error("Usage: pnpm accounts:delete <username>");
    process.exit(1);
  }

  const { dbDir } = resolveDataDirs();
  const db = openDatabase(path.join(dbDir, "studiakids.db"));
  runMigrations(db);

  const accountRepository = new SqliteAccountRepository(db);
  const account = await accountRepository.findByUsername(username);
  if (!account) {
    console.error(`Account "${username}" does not exist.`);
    process.exit(1);
  }

  await deleteAccount({ accountRepository }, account.id);
  console.log(`Account deleted: ${username}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
