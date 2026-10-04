import path from "node:path";
import { ClaudeExerciseGenerator, createLanguageModel, systemClock } from "@studiakids/core";
import { resolveDataDirs } from "../data-dirs.js";
import { openDatabase } from "../db/connection.js";
import { runMigrations } from "../db/migrate.js";
import { regenerateMathsCourses } from "../maths-regeneration.js";

// CLI only (docs/modules/exercise-generator.md, "Régénérer un cours déjà
// généré"): real model calls, about one per game type and maths course.
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const username = args.find((arg) => !arg.startsWith("--"));
  if (!username || args.some((arg) => arg.startsWith("--") && arg !== "--dry-run")) {
    console.error("Usage: pnpm exercises:regenerate-maths <username> [--dry-run]");
    process.exit(1);
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!dryRun && !apiKey) {
    console.error("ANTHROPIC_API_KEY is not set.");
    process.exit(1);
  }

  const { dbDir } = resolveDataDirs();
  const db = openDatabase(path.join(dbDir, "studiakids.db"));
  runMigrations(db);

  const generator = new ClaudeExerciseGenerator(createLanguageModel({ apiKey: apiKey ?? "", model: process.env.ANTHROPIC_MODEL }));
  const result = await regenerateMathsCourses({ db, generator }, username, { dryRun }, systemClock.now());
  if (!result.ok) {
    console.error(`Account "${username}" does not exist.`);
    process.exit(1);
  }
  const { courses, starsBefore, starsAfter } = result.value;
  if (courses.length === 0) console.log(`No maths course to regenerate for ${username}.`);
  for (const course of courses) {
    const failed = course.failed.length > 0 ? ` — failed, to run again: ${course.failed.join(", ")}` : "";
    console.log(`${dryRun ? "[dry run] " : ""}${course.title}: ${course.types.join(", ")}${failed}`);
  }
  console.log(`Stars: ${String(starsBefore)} before, ${String(starsAfter)} after.`);
  if (starsAfter < starsBefore) {
    console.error("Stars were lost: this must never happen, report it.");
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
