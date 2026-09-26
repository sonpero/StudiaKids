import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { nativePhotoSize } from "@studiakids/contracts";
import {
  ClaudeCourseNamer,
  ClaudeExerciseGenerator,
  ClaudeItemSplitter,
  ClaudePhotoExtractor,
  createLanguageModel,
  DEFAULT_MODEL,
  sniffImageType,
  stripJpegMetadata,
  validItems,
  type GameType,
  type Grade,
  type ValidItem,
} from "@studiakids/core";
import { parseArgs, type GeneratorCase, type PhotoCase } from "./args.js";
import { splitMismatch } from "./generator-recording.js";
import { assertWritable, buildFixture, dimensionCollision, jpegSize, sanitizeExchange, smokeReport, type PhotoSize, type RawExchange, type RecordedExchange } from "./recording.js";

// See USAGE in args.ts and docs/modules/ingestion.md. Manual, costs money,
// never run by `pnpm test`. Reads ANTHROPIC_API_KEY (and optionally
// ANTHROPIC_MODEL) from the environment only. --dry-run makes the real
// call and prints the smoke test, but writes nothing.

const EXPECTED: Record<PhotoCase, { legible: boolean; isCoursePage: boolean | null }> = {
  legible: { legible: true, isCoursePage: true },
  illegible: { legible: false, isCoursePage: null },
  "not-a-course": { legible: true, isCoursePage: false },
  "legible-short": { legible: true, isCoursePage: true },
};

const repoRoot = fileURLToPath(new URL("../../../../../", import.meta.url));
const fixturesDir = path.join(repoRoot, "tests/fixtures/ingestion");
const generatorFixturesDir = path.join(repoRoot, "tests/fixtures/exercise-generator");
// The level the splitting and generation fixtures are recorded for; the
// fixture adapters answer whatever the account's level.
const FIXTURE_GRADE: Grade = "CE2";

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function recordedPhotoSizes(): (PhotoSize & { fixtureCase: string })[] {
  const dir = path.join(fixturesDir, "photos");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((file) => file.endsWith(".jpg"))
    .flatMap((file) => {
      const size = jpegSize(new Uint8Array(readFileSync(path.join(dir, file))));
      return size ? [{ ...size, fixtureCase: file.slice(0, file.indexOf(".")) }] : [];
    });
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

type RunOptions = { force: boolean; dryRun: boolean; show: boolean; apiKey: string; model: string };

async function recordPhoto(fixtureCase: PhotoCase, photoPath: string, options: RunOptions): Promise<void> {
  const { force, dryRun, show, apiKey, model } = options;
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
  const clash = dimensionCollision(size, fixtureCase, recordedPhotoSizes());
  if (clash) {
    fail(
      `Photo ${String(size.width)}x${String(size.height)} : même taille que la photo du cas "${clash}". Les fixtures reconnaissent ` +
        `une photo à sa taille (docs/modules/ingestion.md) : recadrez-la de quelques pixels, par exemple :\n  sips -c ${String(size.height)} ${String(size.width - 2)} "${photoPath}" --out photo-recadree.jpg`,
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
  if (show) {
    console.log(`--- Markdown ---\n${got.markdown}\n--- fin ---`);
    if (got.legible && got.isCoursePage) await showNaming(got.markdown, apiKey, model);
  }
  if (got.legible !== expected.legible || (expected.isCoursePage !== null && got.isCoursePage !== expected.isCoursePage)) {
    fail(`ARRÊT : le modèle a répondu legible=${String(got.legible)}, isCoursePage=${String(got.isCoursePage)}, ce qui ne correspond pas au cas "${fixtureCase}". Rien n'a été écrit.`);
  }

  if (dryRun) return console.log("--dry-run : rien n'a été écrit.");
  const fixture = buildFixture({ module: "ingestion", fixtureCase, model, recordedAt: new Date().toISOString(), photo: `photos/${fixtureCase}.jpg`, exchanges });
  write({ [photoFile]: photo, [fixtureFile]: `${JSON.stringify(fixture, null, 2)}\n` }, force);
}

// --show on a photo case: what the namer would propose for this text. An
// extra real call, never recorded (the namer case records its own).
async function showNaming(markdown: string, apiKey: string, model: string): Promise<void> {
  const raw: RawExchange[] = [];
  const namer = new ClaudeCourseNamer(createLanguageModel({ apiKey, model, fetch: recordingFetch(raw) }));
  const result = await namer.suggest({ markdown });
  console.log("--- namer ---");
  report(raw.map(sanitizeExchange), result.ok);
  if (result.ok) console.log(`proposé : « ${result.value.title} », ${result.value.subject}`);
}

function recordedMarkdown(fixtureCase: "legible" | "legible-short" = "legible"): string {
  const file = path.join(fixturesDir, `${fixtureCase}.json`);
  if (!existsSync(file)) fail(`Enregistrez d'abord le cas ingestion "${fixtureCase}" : ce cas part de son texte.`);
  const fixture = JSON.parse(readFileSync(file, "utf8")) as { exchanges: RecordedExchange[] };
  const last = fixture.exchanges.at(-1)?.body as { content?: { type: string; input?: { markdown?: string } }[] } | undefined;
  const markdown = last?.content?.find((block) => block.type === "tool_use")?.input?.markdown;
  if (!markdown) fail(`Le cas ingestion "${fixtureCase}" n'a pas de Markdown.`);
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

// A namer answer on a real-looking lesson whose title runs past three
// words (decided 2026-09-26). The page is extracted (real call, smoke
// test, never recorded nor written) and only the namer's exchanges are
// kept: the photo must never reach photos/, where the fixture adapter
// reads one size per case.
async function recordLongTitleNamer(photoPath: string, { force, dryRun, show, apiKey, model }: RunOptions): Promise<void> {
  const stripped = stripJpegMetadata(new Uint8Array(readFileSync(photoPath)));
  if (!stripped.ok) fail("JPEG illisible.");
  const size = jpegSize(stripped.value);
  if (!size) fail("Dimensions introuvables dans le JPEG.");
  const target = nativePhotoSize(size.width, size.height);
  if (target.width !== size.width || target.height !== size.height) fail(`Photo plus grande que la taille native : réduisez-la à ${String(target.width)}x${String(target.height)}.`);

  const fixtureFile = path.join(fixturesDir, "namer-long-title.json");
  if (!dryRun) {
    const writable = assertWritable([fixtureFile], force);
    if (!writable.ok) fail(`Refus d'écraser (relancer avec --force) :\n  ${writable.error.join("\n  ")}`);
  }

  const extractionExchanges: RawExchange[] = [];
  const extracted = await new ClaudePhotoExtractor(createLanguageModel({ apiKey, model, fetch: recordingFetch(extractionExchanges) })).extract({ bytes: stripped.value });
  console.log("--- extraction (non enregistrée) ---");
  report(extractionExchanges.map(sanitizeExchange), extracted.ok);
  if (!extracted.ok || !extracted.value.legible || !extracted.value.isCoursePage) fail("ARRÊT : la page n'a pas été lue comme une page de cours lisible. Rien n'a été écrit.");
  if (show) console.log(`--- Markdown ---\n${extracted.value.markdown}\n--- fin ---`);

  const raw: RawExchange[] = [];
  const result = await new ClaudeCourseNamer(createLanguageModel({ apiKey, model, fetch: recordingFetch(raw) })).suggest({ markdown: extracted.value.markdown });
  const exchanges = raw.map(sanitizeExchange);
  console.log("--- namer ---");
  report(exchanges, result.ok);
  if (!result.ok) return;
  console.log(`proposé : « ${String(result.value.title)} », ${String(result.value.subject)}`);
  const title = result.value.title ?? "";
  if (exchanges.length !== 1 || title.trim().split(/\s+/).length <= 3) {
    fail("ARRÊT : il faut un titre de plus de trois mots accepté du premier coup, sinon cette fixture ne prouve rien. Rien n'a été écrit.");
  }

  if (dryRun) return console.log("--dry-run : rien n'a été écrit.");
  const fixture = buildFixture({ module: "ingestion", fixtureCase: "namer-long-title", model, recordedAt: new Date().toISOString(), exchanges });
  write({ [fixtureFile]: `${JSON.stringify(fixture, null, 2)}\n` }, force);
}

// Serves a recorded fixture's responses in order: `generate` reads the
// recorded split through the real adapter (repair and validation
// included) without paying for it again.
function replayRecorded(file: string): typeof fetch {
  const fixture = JSON.parse(readFileSync(file, "utf8")) as { exchanges: RecordedExchange[] };
  let next = 0;
  return () => {
    const exchange = fixture.exchanges[next++];
    if (!exchange) fail(`${path.relative(repoRoot, file)} : plus de réponse enregistrée.`);
    const body = typeof exchange.body === "string" ? exchange.body : JSON.stringify(exchange.body);
    return Promise.resolve(new Response(body, { status: exchange.status, headers: { "content-type": "application/json" } }));
  };
}

async function recordSplit(fixtureCase: Exclude<GeneratorCase, "generate">, { force, dryRun, show, apiKey, model }: RunOptions): Promise<void> {
  const sourceCase = fixtureCase === "split" ? "legible" : "legible-short";
  const markdown = recordedMarkdown(sourceCase);
  const fixtureFile = path.join(generatorFixturesDir, `${fixtureCase}.json`);
  if (!dryRun) {
    const writable = assertWritable([fixtureFile], force);
    if (!writable.ok) fail(`Refus d'écraser (relancer avec --force) :\n  ${writable.error.join("\n  ")}`);
  }

  const raw: RawExchange[] = [];
  const result = await new ClaudeItemSplitter(createLanguageModel({ apiKey, model, fetch: recordingFetch(raw) })).split({ markdown, grade: FIXTURE_GRADE });
  const exchanges = raw.map(sanitizeExchange);
  report(exchanges, result.ok);
  if (!result.ok) return;
  const items = validItems(result.value);
  console.log(`${String(result.value.length)} items proposés, ${String(items.length)} valides`);
  if (show) for (const item of items) console.log(`- ${item.title} [${item.applicableGameTypes.join(", ")}]`);
  const mismatch = splitMismatch(fixtureCase, items.length);
  if (mismatch) fail(`ARRÊT : ${mismatch} Rien n'a été écrit.`);

  if (dryRun) return console.log("--dry-run : rien n'a été écrit.");
  const fixture = buildFixture({ module: "exercise-generator", fixtureCase, model, recordedAt: new Date().toISOString(), source: `ingestion/${sourceCase}.json`, exchanges });
  write({ [fixtureFile]: `${JSON.stringify(fixture, null, 2)}\n` }, force);
}

// One fixture per game type the recorded split proposes, each call made
// on that type's items, exactly as the generation job would.
async function recordGeneration({ force, dryRun, show, apiKey, model }: RunOptions): Promise<void> {
  const splitFile = path.join(generatorFixturesDir, "split.json");
  if (!existsSync(splitFile)) fail("Enregistrez d'abord le cas \"split\" : la génération part de ses items.");
  const split = await new ClaudeItemSplitter(createLanguageModel({ apiKey: "replay", model, fetch: replayRecorded(splitFile) })).split({ markdown: "", grade: FIXTURE_GRADE });
  if (!split.ok) fail(`split.json ne se relit pas : ${split.error.message}`);
  const items: ValidItem[] = validItems(split.value);
  const courseMarkdown = recordedMarkdown("legible");
  const types: GameType[] = [];
  for (const item of items) for (const type of item.applicableGameTypes) if (!types.includes(type)) types.push(type);
  const files = types.map((type) => path.join(generatorFixturesDir, `generate-${type}.json`));
  if (!dryRun) {
    const writable = assertWritable(files, force);
    if (!writable.ok) fail(`Refus d'écraser (relancer avec --force) :\n  ${writable.error.join("\n  ")}`);
  }

  const written: Record<string, string> = {};
  for (const [i, type] of types.entries()) {
    const withType = items.filter((item) => item.applicableGameTypes.includes(type));
    const raw: RawExchange[] = [];
    const result = await new ClaudeExerciseGenerator(createLanguageModel({ apiKey, model, fetch: recordingFetch(raw) })).generate({ type, items: withType, courseMarkdown, grade: FIXTURE_GRADE });
    const exchanges = raw.map(sanitizeExchange);
    console.log(`--- ${type} (${String(withType.length)} items) ---`);
    report(exchanges, result.ok);
    if (!result.ok) return;
    console.log(`${String(result.value.length)} exercices reçus`);
    if (show) console.log(JSON.stringify(result.value, null, 2));
    const fixture = buildFixture({ module: "exercise-generator", fixtureCase: `generate-${type}`, model, recordedAt: new Date().toISOString(), source: "exercise-generator/split.json", exchanges });
    written[files[i]!] = `${JSON.stringify(fixture, null, 2)}\n`;
  }
  if (dryRun) return console.log("--dry-run : rien n'a été écrit.");
  write(written, force);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.ok) fail(args.error);
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) fail("ANTHROPIC_API_KEY absente de l'environnement.");
  const model = process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;
  console.log(`modèle : ${model}${args.value.dryRun ? " (--dry-run)" : ""}`);

  const options = { force: args.value.force, dryRun: args.value.dryRun, show: args.value.show, apiKey, model };
  if (args.value.module === "exercise-generator") {
    const generatorCase = args.value.fixtureCase;
    return generatorCase === "generate" ? recordGeneration(options) : recordSplit(generatorCase, options);
  }
  const { fixtureCase, photoPath } = args.value;
  if (fixtureCase === "namer") return recordNamer(options);
  if (photoPath === null) fail("--photo manquant.");
  if (fixtureCase === "namer-long-title") return recordLongTitleNamer(photoPath, options);
  return recordPhoto(fixtureCase, photoPath, options);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
