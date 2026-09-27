import path from "node:path";
import { systemClock } from "@studiakids/core";
import { resolveDataDirs } from "../data-dirs.js";
import { openDatabase } from "../db/connection.js";
import { runMigrations } from "../db/migrate.js";
import { tutorHistory } from "../tutor-history.js";

// CLI only, never reachable over HTTP (docs/securite.md, "Historique du
// tuteur : consultable, jamais secret").
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const username = args.find((arg) => !arg.startsWith("--"));
  if (!username || args.some((arg) => arg.startsWith("--") && arg !== "--json")) {
    console.error("Usage: pnpm tutor:history <username> [--json]");
    process.exit(1);
  }

  const { dbDir } = resolveDataDirs();
  const db = openDatabase(path.join(dbDir, "studiakids.db"));
  runMigrations(db);

  const result = await tutorHistory(db, username, { json }, systemClock.now());
  if (!result.ok) {
    console.error(`Account "${username}" does not exist.`);
    process.exit(1);
  }
  console.log(result.value);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
