import { readFileSync } from "node:fs";
import { anchoringProblem, parseExercise, type GameType } from "@studiakids/core";

const [detailsPath] = process.argv.slice(2);
type Detail = { id: string; items: { title: string; types: GameType[] }[]; raw?: Record<string, unknown[]>; judged?: { type: string; content: unknown; verdict: { anchored: boolean; chatty: boolean; reason: string } | null }[] };
const details = JSON.parse(readFileSync(detailsPath ?? "", "utf8")) as Detail[];
for (const detail of details) {
  if (!detail.raw) continue;
  const markdown = (JSON.parse(readFileSync(`../../tests/eval/.cache/${detail.id}.extraction.json`, "utf8")) as { markdown: string }).markdown;
  console.log(`===== ${detail.id}`);
  for (const [type, list] of Object.entries(detail.raw)) {
    const count = detail.items.filter((item) => item.types.includes(type as GameType)).length;
    for (const candidate of list) {
      const parsed = parseExercise(type as GameType, candidate, count);
      const problem = parsed.ok ? anchoringProblem(parsed.value.content, markdown) : parsed.error;
      if (problem !== null) console.log(`  ${type} REJET ${problem} :: ${JSON.stringify(candidate).slice(0, 260)}`);
    }
  }
  for (const entry of detail.judged ?? []) {
    if (entry.verdict && (!entry.verdict.anchored || entry.verdict.chatty)) console.log(`  ${entry.type} JUGE ${JSON.stringify(entry.verdict)} :: ${JSON.stringify(entry.content).slice(0, 260)}`);
  }
}
