import path from "node:path";
import { Argon2PasswordHasher, createAccount, SqliteAccountRepository, uuidV7Generator, type Grade } from "@studiakids/core";
import { resolveDataDirs } from "../data-dirs.js";
import { openDatabase } from "../db/connection.js";
import { runMigrations } from "../db/migrate.js";
import { readPassword } from "./read-password.js";

const GRADES: Grade[] = ["CP", "CE1", "CE2", "CM1", "CM2", "6e"];

function isGrade(value: string): value is Grade {
  return (GRADES as string[]).includes(value);
}

// CLI only, never reachable over HTTP (docs/modules/auth.md). Only the
// password is prompted interactively: Node's readline can't reliably ask
// more than one question over piped (non-TTY) stdin, which scripted usage
// and tests both rely on, so firstName/grade are plain positional args.
async function main(): Promise<void> {
  const [username, firstName, gradeInput] = process.argv.slice(2);
  if (!username || !firstName || !gradeInput) {
    console.error(`Usage: pnpm accounts:create <username> <firstName> <grade>\nGrade must be one of: ${GRADES.join(", ")}`);
    process.exit(1);
  }

  if (firstName.length < 1 || firstName.length > 30) {
    console.error("First name must be 1 to 30 characters.");
    process.exit(1);
  }
  if (!isGrade(gradeInput)) {
    console.error(`Grade must be one of: ${GRADES.join(", ")}`);
    process.exit(1);
  }

  const password = await readPassword("Password: ");
  if (!password) {
    console.error("Password cannot be empty.");
    process.exit(1);
  }

  const { dbDir } = resolveDataDirs();
  const db = openDatabase(path.join(dbDir, "studiakids.db"));
  runMigrations(db);

  const result = await createAccount(
    { accountRepository: new SqliteAccountRepository(db), passwordHasher: new Argon2PasswordHasher(), idGenerator: uuidV7Generator },
    username,
    password,
    firstName,
    gradeInput,
    new Date(),
  );

  if (!result.ok) {
    console.error(`Account "${username}" already exists.`);
    process.exit(1);
  }
  console.log(`Account ready: ${username} (id ${result.value.id})`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
