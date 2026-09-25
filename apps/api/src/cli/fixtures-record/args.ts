import { err, ok, type Result } from "@studiakids/core";

export const PHOTO_CASES = ["legible", "illegible", "not-a-course"] as const;
export type PhotoCase = (typeof PHOTO_CASES)[number];
export type FixtureCase = PhotoCase | "namer";

export type RecordArgs = { module: "ingestion"; fixtureCase: FixtureCase; photoPath: string | null; force: boolean; dryRun: boolean };

export const USAGE =
  "Usage : pnpm fixtures:record ingestion <legible|illegible|not-a-course> --photo <fichier.jpg> [--force] [--dry-run]\n" +
  "        pnpm fixtures:record ingestion namer [--force] [--dry-run]\n" +
  "--dry-run : appel réel et test de fumée, rien n'est écrit.";

const isPhotoCase = (value: string): value is PhotoCase => (PHOTO_CASES as readonly string[]).includes(value);

export function parseArgs(argv: string[]): Result<RecordArgs, string> {
  const [moduleName, fixtureCase, ...rest] = argv;
  if (moduleName !== "ingestion" || fixtureCase === undefined) return err(USAGE);
  if (fixtureCase !== "namer" && !isPhotoCase(fixtureCase)) return err(USAGE);

  let photoPath: string | null = null;
  let force = false;
  let dryRun = false;
  for (let i = 0; i < rest.length; i++) {
    const option = rest[i];
    if (option === "--force") force = true;
    else if (option === "--dry-run") dryRun = true;
    else if (option === "--photo") {
      const value = rest[++i];
      if (value === undefined || value.startsWith("--")) return err(USAGE);
      photoPath = value;
    } else return err(USAGE);
  }
  if ((fixtureCase === "namer") !== (photoPath === null)) return err(USAGE);
  return ok({ module: "ingestion", fixtureCase, photoPath, force, dryRun });
}
