import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  anchoringProblem,
  ClaudeExerciseGenerator,
  ClaudeItemSplitter,
  ClaudePhotoExtractor,
  coverageOutcome,
  createLanguageModel,
  generateWithRetry,
  parseExercise,
  PROMPTS_VERSION,
  stripJpegMetadata,
  validItems,
  type GameType,
  type Grade,
} from "@studiakids/core";
import { z } from "zod";
import { aggregate, costUsd, scoreCase, type CaseRun, type ExerciseRecord } from "./scoring.js";

// pnpm eval — manual, costs money, never in CI (CLAUDE.md, Commandes).
// Runs extraction (cached: its prompt is not the one being tuned), split,
// one generation call per game type and a judge call on each case of
// tests/eval/corpus, then writes the scores. Options: --cases a,b
// --max-usd 1.2 --reextract.
const repoRoot = fileURLToPath(new URL("../../../../../", import.meta.url));
const evalDir = path.join(repoRoot, "tests/eval");
const cacheDir = path.join(evalDir, ".cache");

type Lesson = { id: string; grade: Grade; subject: string; calc: boolean; short: boolean; degrade: string[] };

function option(name: string): string | undefined {
  const at = process.argv.indexOf(name);
  return at >= 0 ? process.argv[at + 1] : undefined;
}

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error("ANTHROPIC_API_KEY absente de l'environnement.");
  process.exit(1);
}
const maxUsd = Number(option("--max-usd") ?? "1.2");
const only = option("--cases")?.split(",");
const reextract = process.argv.includes("--reextract");
let spentUsd = 0;
const metered: typeof fetch = async (input, init) => {
  if (spentUsd >= maxUsd) throw new Error(`budget atteint (${spentUsd.toFixed(4)} $)`);
  const response = await fetch(input, init);
  const body = (await response.clone().json().catch(() => ({}))) as { usage?: { input_tokens?: number; output_tokens?: number } };
  spentUsd += costUsd({ input: body.usage?.input_tokens ?? 0, output: body.usage?.output_tokens ?? 0 });
  return response;
};
const model = createLanguageModel({ apiKey, fetch: metered });

const judgeText = readFileSync(path.join(evalDir, "judge-prompt.md"), "utf8");
const judgeVersion = judgeText.split("\n")[0]?.trim() ?? "judge ?";
const verdict = z.object({ index: z.number(), anchored: z.boolean(), chatty: z.boolean(), reason: z.string() });
// Each verdict is read on its own: a malformed one never loses the call.
const verdictSchema = z.object({ verdicts: z.array(z.unknown()).describe("Un verdict par exercice : { index, anchored, chatty, reason }.") });

async function judge(markdown: string, exercises: { type: string; content: unknown }[]) {
  if (exercises.length === 0) return new Map<number, { anchored: boolean; chatty: boolean; reason: string }>();
  const list = exercises.map((e, i) => `${String(i)}. [${e.type}] ${JSON.stringify(e.content)}`).join("\n");
  const result = await generateWithRetry(model, verdictSchema, (feedback) => [
    { role: "user", content: `${judgeText}\n\nLeçon :\n${markdown}\n\nExercices :\n${list}${feedback ? `\n\n${feedback}` : ""}` },
  ]);
  const verdicts = new Map<number, { anchored: boolean; chatty: boolean; reason: string }>();
  if (result.ok) {
    for (const candidate of result.value.verdicts) {
      const parsed = verdict.safeParse(candidate);
      if (parsed.success) verdicts.set(parsed.data.index, parsed.data);
    }
  }
  return verdicts;
}

async function extract(lesson: Lesson): Promise<string> {
  const cached = path.join(cacheDir, `${lesson.id}.extraction.json`);
  if (!reextract && existsSync(cached)) return (JSON.parse(readFileSync(cached, "utf8")) as { markdown: string }).markdown;
  const stripped = stripJpegMetadata(new Uint8Array(readFileSync(path.join(evalDir, "corpus", `${lesson.id}.jpg`))));
  if (!stripped.ok) throw new Error(`${lesson.id}: JPEG illisible`);
  const result = await new ClaudePhotoExtractor(model).extract({ bytes: stripped.value });
  if (!result.ok) throw new Error(`${lesson.id}: extraction en échec : ${result.error.message}`);
  writeFileSync(cached, JSON.stringify(result.value, null, 2));
  return result.value.markdown;
}

async function runCase(lesson: Lesson, details: unknown[]): Promise<CaseRun> {
  const before = spentUsd;
  const markdown = await extract(lesson);
  const split = await new ClaudeItemSplitter(model).split({ markdown, grade: lesson.grade });
  if (!split.ok) throw new Error(`${lesson.id}: découpage en échec : ${split.error.message}`);
  const items = validItems(split.value);
  const outcome = coverageOutcome(items.length);
  const records: ExerciseRecord[] = [];
  const judged: { record: ExerciseRecord; type: string; content: unknown }[] = [];
  const raw: Record<string, unknown[]> = {};
  if (outcome === "items_ready") {
    const types: GameType[] = [];
    for (const item of items) for (const type of item.applicableGameTypes) if (!types.includes(type)) types.push(type);
    for (const type of types) {
      const withType = items.filter((item) => item.applicableGameTypes.includes(type));
      const generated = await new ClaudeExerciseGenerator(model).generate({ type, items: withType, courseMarkdown: markdown, grade: lesson.grade });
      raw[type] = generated.ok ? generated.value : [`échec : ${generated.ok ? "" : generated.error.message}`];
      if (!generated.ok) continue;
      for (const candidate of generated.value) {
        const parsed = parseExercise(type, candidate, withType.length);
        const record: ExerciseRecord = { type, shapeOk: parsed.ok, mechanical: parsed.ok ? anchoringProblem(parsed.value.content, markdown) : null, judge: null };
        records.push(record);
        if (parsed.ok && record.mechanical === null) judged.push({ record, type, content: parsed.value.content });
      }
    }
    const verdicts = await judge(markdown, judged);
    judged.forEach((entry, index) => {
      const verdict = verdicts.get(index);
      entry.record.judge = verdict ? { anchored: verdict.anchored, chatty: verdict.chatty } : null;
    });
    details.push({ id: lesson.id, items: items.map((i) => ({ title: i.title, types: i.applicableGameTypes })), raw, judged: judged.map((j, i) => ({ type: j.type, content: j.content, verdict: verdicts.get(i) ?? null })) });
  } else {
    details.push({ id: lesson.id, items: items.map((i) => i.title), outcome });
  }
  return { id: lesson.id, calc: lesson.calc, short: lesson.short, outcome, itemCount: items.length, exercises: records, costUsd: spentUsd - before };
}

async function main(): Promise<void> {
  mkdirSync(cacheDir, { recursive: true });
  const lessons = (JSON.parse(readFileSync(path.join(evalDir, "corpus", "index.json"), "utf8")) as Lesson[]).filter((l) => !only || only.includes(l.id));
  const scores = [];
  const details: unknown[] = [];
  for (const lesson of lessons) {
    try {
      const run = await runCase(lesson, details);
      const score = scoreCase(run);
      scores.push(score);
      console.log(`${lesson.id}: ${run.outcome}, ${String(run.itemCount)} items, ancrage ${(score.anchoring * 100).toFixed(0)} %, ${run.costUsd.toFixed(4)} $`);
    } catch (error) {
      console.error(`${lesson.id}: ${String(error)}`);
      if (spentUsd >= maxUsd) break;
    }
  }
  const total = aggregate(scores);
  const stamp = new Date().toISOString();
  const result = { promptsVersion: PROMPTS_VERSION, judgeVersion, date: stamp, spentUsd, aggregate: total, cases: scores };
  mkdirSync(path.join(evalDir, "results"), { recursive: true });
  writeFileSync(path.join(evalDir, "results", `prompts-v${PROMPTS_VERSION}.json`), `${JSON.stringify(result, null, 2)}\n`);
  writeFileSync(path.join(cacheDir, `details-v${PROMPTS_VERSION}.json`), JSON.stringify(details, null, 2));
  console.log(JSON.stringify(total, null, 2));
  console.log(`dépensé : ${spentUsd.toFixed(4)} $`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
