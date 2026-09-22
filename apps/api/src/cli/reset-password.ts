import path from "node:path";
import { Argon2PasswordHasher, resetPassword, SqliteAccountRepository } from "@studiakids/core";
import { resolveDataDirs } from "../data-dirs.js";
import { openDatabase } from "../db/connection.js";
import { runMigrations } from "../db/migrate.js";
import { readPassword } from "./read-password.js";

// CLI only, never reachable over HTTP (docs/modules/auth.md). Invalidates
// every existing session for the account (sessionVersion increments).
async function main(): Promise<void> {
  const username = process.argv[2];
  if (!username) {
    console.error("Usage: pnpm accounts:reset-password <username>");
    process.exit(1);
  }

  const password = await readPassword("New password: ");
  if (!password) {
    console.error("Password cannot be empty.");
    process.exit(1);
  }

  const { dbDir } = resolveDataDirs();
  const db = openDatabase(path.join(dbDir, "studiakids.db"));
  runMigrations(db);

  const result = await resetPassword(
    { accountRepository: new SqliteAccountRepository(db), passwordHasher: new Argon2PasswordHasher() },
    username,
    password,
    new Date(),
  );

  if (!result.ok) {
    console.error(`Account "${username}" does not exist.`);
    process.exit(1);
  }
  console.log(`Password reset for account: ${username}. Existing sessions are now invalid.`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
