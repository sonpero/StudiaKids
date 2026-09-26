import { err, ok, type Result } from "@studiakids/core";

// legible-short: a lesson too short for a game (fewer than 6 items), the
// page the short-lesson scenario photographs.
export const PHOTO_CASES = ["legible", "illegible", "not-a-course", "legible-short"] as const;
export type PhotoCase = (typeof PHOTO_CASES)[number];
// namer-long-title: extracts a (generated) page, then records only the
// namer's answer on its text — the page itself is never written.
export type IngestionCase = PhotoCase | "namer" | "namer-long-title";

// split / split-short: the splitter's answer on the text recorded by
// ingestion's legible / legible-short. generate: one answer per game type
// the recorded split proposes.
export const GENERATOR_CASES = ["split", "split-short", "generate"] as const;
export type GeneratorCase = (typeof GENERATOR_CASES)[number];

type Options = { photoPath: string | null; force: boolean; dryRun: boolean; show: boolean };
export type RecordArgs = ({ module: "ingestion"; fixtureCase: IngestionCase } | { module: "exercise-generator"; fixtureCase: GeneratorCase }) & Options;

export const USAGE =
  "Usage : pnpm fixtures:record ingestion <legible|illegible|not-a-course|legible-short> --photo <fichier.jpg> [--force] [--dry-run] [--show]\n" +
  "        pnpm fixtures:record ingestion namer [--force] [--dry-run] [--show]\n" +
  "        pnpm fixtures:record ingestion namer-long-title --photo <page-générée.jpg> [--force] [--dry-run] [--show]\n" +
  "        pnpm fixtures:record exercise-generator <split|split-short|generate> [--force] [--dry-run] [--show]\n" +
  "--dry-run : appel réel et test de fumée, rien n'est écrit.\n" +
  "--show : affiche le Markdown complet et la proposition du namer (appel supplémentaire pour un cas photo), ou la réponse complète.";

const isPhotoCase = (value: string): value is PhotoCase => (PHOTO_CASES as readonly string[]).includes(value);
const isGeneratorCase = (value: string): value is GeneratorCase => (GENERATOR_CASES as readonly string[]).includes(value);

function parseOptions(rest: string[]): Result<Options, string> {
  let photoPath: string | null = null;
  let force = false;
  let dryRun = false;
  let show = false;
  for (let i = 0; i < rest.length; i++) {
    const option = rest[i];
    if (option === "--force") force = true;
    else if (option === "--dry-run") dryRun = true;
    else if (option === "--show") show = true;
    else if (option === "--photo") {
      const value = rest[++i];
      if (value === undefined || value.startsWith("--")) return err(USAGE);
      photoPath = value;
    } else return err(USAGE);
  }
  return ok({ photoPath, force, dryRun, show });
}

export function parseArgs(argv: string[]): Result<RecordArgs, string> {
  const [moduleName, fixtureCase, ...rest] = argv;
  if (fixtureCase === undefined) return err(USAGE);
  const options = parseOptions(rest);
  if (!options.ok) return options;

  if (moduleName === "exercise-generator") {
    if (!isGeneratorCase(fixtureCase) || options.value.photoPath !== null) return err(USAGE);
    return ok({ module: "exercise-generator", fixtureCase, ...options.value });
  }
  if (moduleName !== "ingestion") return err(USAGE);
  if (fixtureCase !== "namer" && fixtureCase !== "namer-long-title" && !isPhotoCase(fixtureCase)) return err(USAGE);
  if ((fixtureCase === "namer") !== (options.value.photoPath === null)) return err(USAGE);
  return ok({ module: "ingestion", fixtureCase, ...options.value });
}
