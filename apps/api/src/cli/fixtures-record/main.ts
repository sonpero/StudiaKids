import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { nativePhotoSize } from "@studiakids/contracts";
import {
  ClaudeCourseNamer,
  ClaudePhotoExtractor,
  createLanguageModel,
  DEFAULT_MODEL,
  sniffImageType,
  stripJpegMetadata,
} from "@studiakids/core";
import { parseArgs, type PhotoCase } from "./args.js";
import { assertWritable, buildFixture, jpegSize, sanitizeExchange, smokeReport, type RawExchange, type RecordedExchange } from "./recording.js";

// See USAGE in args.ts and docs/modules/ingestion.md. Manual, costs money,
// never run by `pnpm test`. Reads ANTHROPIC_API_KEY (and optionally
// ANTHROPIC_MODEL) from the environment only. --dry-run makes the real
// call and prints the smoke test, but writes nothing.

const EXPECTED: Record<PhotoCase, { legible: boolean; isCoursePage: boolean | null }> = {
  legible: { legible: true, isCoursePage: true },
  illegible: { legible: false, isCoursePage: null },
  "not-a-course": { legible: true, isCoursePage: false },
};

const repoRoot = fileURLToPath(new URL("../../../../../", import.meta.url));
const fixturesDir = path.join(repoRoot, "tests/fixtures/ingestion");

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function recordingFetch(exchanges: RawExchange[]): typeof fetch {
  return async (input, init) => {
    const started = performance.now();
    const response = await fetch(input, init);
    exchanges.push({
      status: response.status,
      latencyMs: Math.round(performance.now() - started),
      headers: Object.fromEntries(response.headers.entries()),
      bodyText: await response.clone().text(),
    });
    return response;
  };
}

function write(files: Record<string, string | Uint8Array>, force: boolean): void {
  const writable = assertWritable(Object.keys(files), force);
  if (!writable.ok) fail(`Refus d'écraser (relancer avec --force) :\n  ${writable.error.join("\n  ")}`);
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, typeof content === "string" ? content : Buffer.from(content));
    console.log(`écrit : ${path.relative(repoRoot, file)}`);
  }
}

function report(exchanges: RecordedExchange[], adapterSucceeded: boolean, minimumInputTokens?: number): void {
  const smoke = smokeReport(exchanges, { adapterSucceeded, minimumInputTokens });
  console.log(smoke.lines.join("\n"));
  if (!smoke.ok) fail("ARRÊT : le test de fumée a échoué, rien n'a été écrit.");
}

type RunOptions = { force: boolean; dryRun: boolean; apiKey: string; model: string };

async function recordPhoto(fixtureCase: PhotoCase, photoPath: string, { force, dryRun, apiKey, model }: RunOptions): Promise<void> {
  const original = new Uint8Array(readFileSync(photoPath));
  if (sniffImageType(original) !== "jpeg") fail("La photo doit être un vrai JPEG, comme ceux que le navigateur envoie.");
  const stripped = stripJpegMetadata(original);
  if (!stripped.ok) fail("JPEG illisible.");
  const photo = stripped.value;

  // Recorded at the size the browser would send, or input_tokens would not
  // say anything about the model's native resolution.
  const size = jpegSize(photo);
  if (!size) fail("Dimensions introuvables dans le JPEG.");
  const target = nativePhotoSize(size.width, size.height);
  if (target.width !== size.width || target.height !== size.height) {
    fail(
      `Photo ${String(size.width)}x${String(size.height)} : plus grande que la taille native. Réduisez-la d'abord à ` +
        `${String(target.width)}x${String(target.height)}, par exemple :\n  sips -z ${String(target.height)} ${String(target.width)} "${photoPath}" --out photo-native.jpg`,
    );
  }
  const visualTokens = Math.ceil(size.width / 28) * Math.ceil(size.height / 28);

  const photoFile = path.join(fixturesDir, "photos", `${fixtureCase}.jpg`);
  const fixtureFile = path.join(fixturesDir, `${fixtureCase}.json`);
  if (!dryRun) {
    const writable = assertWritable([photoFile, fixtureFile], force);
    if (!writable.ok) fail(`Refus d'écraser (relancer avec --force) :\n  ${writable.error.join("\n  ")}`);
  }

  const raw: RawExchange[] = [];
  const extractor = new ClaudePhotoExtractor(createLanguageModel({ apiKey, model, fetch: recordingFetch(raw) }));
  const result = await extractor.extract({ bytes: photo });
  const exchanges = raw.map(sanitizeExchange);

  console.log(`photo ${String(size.width)}x${String(size.height)}, ${String(visualTokens)} tokens visuels attendus`);
  report(exchanges, result.ok, visualTokens);
  if (!result.ok) return;

  const expected = EXPECTED[fixtureCase];
  const got = result.value;
  console.log(`réponse : legible=${String(got.legible)}, isCoursePage=${String(got.isCoursePage)}, ${String(got.markdown.length)} caractères de Markdown`);
  if (got.legible !== expected.legible || (expected.isCoursePage !== null && got.isCoursePage !== expected.isCoursePage)) {
    fail(`ARRÊT : le modèle a répondu legible=${String(got.legible)}, isCoursePage=${String(got.isCoursePage)}, ce qui ne correspond pas au cas "${fixtureCase}". Rien n'a été écrit.`);
  }

  if (dryRun) return console.log("--dry-run : rien n'a été écrit.");
  const fixture = buildFixture({ module: "ingestion", fixtureCase, model, recordedAt: new Date().toISOString(), photo: `photos/${fixtureCase}.jpg`, exchanges });
  write({ [photoFile]: photo, [fixtureFile]: `${JSON.stringify(fixture, null, 2)}\n` }, force);
}

function recordedMarkdown(): string {
  const fixture = JSON.parse(readFileSync(path.join(fixturesDir, "legible.json"), "utf8")) as { exchanges: RecordedExchange[] };
  const last = fixture.exchanges.at(-1)?.body as { content?: { type: string; input?: { markdown?: string } }[] } | undefined;
  const markdown = last?.content?.find((block) => block.type === "tool_use")?.input?.markdown;
  if (!markdown) fail("Enregistrez d'abord le cas \"legible\" : le cas \"namer\" nomme son texte.");
  return markdown;
}

async function recordNamer({ force, dryRun, apiKey, model }: RunOptions): Promise<void> {
  const fixtureFile = path.join(fixturesDir, "namer.json");
  if (!dryRun) {
    const writable = assertWritable([fixtureFile], force);
    if (!writable.ok) fail(`Refus d'écraser (relancer avec --force) :\n  ${writable.error.join("\n  ")}`);
  }

  const raw: RawExchange[] = [];
  const namer = new ClaudeCourseNamer(createLanguageModel({ apiKey, model, fetch: recordingFetch(raw) }));
  const result = await namer.suggest({ markdown: recordedMarkdown() });
  const exchanges = raw.map(sanitizeExchange);

  report(exchanges, result.ok);
  if (result.ok) console.log(`proposé : « ${result.value.title} », ${result.value.subject}`);
  if (dryRun) return console.log("--dry-run : rien n'a été écrit.");
  const fixture = buildFixture({ module: "ingestion", fixtureCase: "namer", model, recordedAt: new Date().toISOString(), exchanges });
  write({ [fixtureFile]: `${JSON.stringify(fixture, null, 2)}\n` }, force);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.ok) fail(args.error);
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) fail("ANTHROPIC_API_KEY absente de l'environnement.");
  const model = process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;
  console.log(`modèle : ${model}${args.value.dryRun ? " (--dry-run)" : ""}`);

  const options = { force: args.value.force, dryRun: args.value.dryRun, apiKey, model };
  const { fixtureCase, photoPath } = args.value;
  if (fixtureCase === "namer") return recordNamer(options);
  if (photoPath === null) fail("--photo manquant.");
  return recordPhoto(fixtureCase, photoPath, options);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
