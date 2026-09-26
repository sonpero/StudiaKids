import type { JobContext, JobError } from "../../jobs/index.js";
import { err, ok, type IdGenerator, type Result } from "../../shared/index.js";
import { anchoringProblem } from "../domain/anchoring.js";
import { parseExercise, type ExerciseContent } from "../domain/exercises.js";
import type { CourseTextSource, Exercise, ExerciseGenerator, Item, ItemRepository } from "../domain/ports.js";
import { needsRegeneration } from "../domain/regeneration.js";
import type { GenerateExercisesPayload } from "./jobs.js";

export { GENERATE_EXERCISES_JOB } from "./jobs.js";

export interface HandleGenerationJobDeps {
  courses: CourseTextSource;
  generator: ExerciseGenerator;
  repo: ItemRepository;
  idGenerator: IdGenerator;
}

// Key order aside, so that an unchanged exercise is recognised.
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

// Checked one by one: shape, item in the list, anchoring rule. An invalid
// exercise is dropped alone; the first valid one per item is kept.
function validExercises(raw: unknown[], items: Item[], type: GenerateExercisesPayload["type"], courseMarkdown: string): Map<number, ExerciseContent> {
  const valid = new Map<number, ExerciseContent>();
  for (const candidate of raw) {
    const parsed = parseExercise(type, candidate, items.length);
    if (!parsed.ok || valid.has(parsed.value.item)) continue;
    if (anchoringProblem(parsed.value.content, courseMarkdown) !== null) continue;
    valid.set(parsed.value.item, parsed.value.content);
  }
  return valid;
}

// One call for the type and every item carrying it; regenerated once below
// the threshold; written with a comparison first, so that an unchanged
// exercise keeps its id — and, from M4, its attempts and stars.
export async function handleGenerationJob(deps: HandleGenerationJobDeps, payload: GenerateExercisesPayload, ctx: JobContext): Promise<Result<void, JobError>> {
  const text = await deps.courses.read(ctx.userId, payload.courseId);
  if (!text.ok) return ok(undefined);
  const items = (await deps.repo.listItems(ctx.userId, payload.courseId)).filter(
    (item) => item.applicableGameTypes.includes(payload.type) && (payload.itemIds === undefined || payload.itemIds.includes(item.id)),
  );
  if (items.length === 0) return ok(undefined);

  const ask = () => deps.generator.generate({ type: payload.type, items: items.map(({ title, body }) => ({ title, body })), courseMarkdown: text.value.markdown, grade: text.value.grade });
  const first = await ask();
  if (!first.ok) return err(first.error.message);
  let valid = validExercises(first.value, items, payload.type, text.value.markdown);
  if (needsRegeneration(items.length, valid.size)) {
    const second = await ask();
    if (second.ok) {
      const retried = validExercises(second.value, items, payload.type, text.value.markdown);
      if (retried.size > valid.size) valid = retried;
    }
  }

  const existing = await deps.repo.listExercises(ctx.userId, items.map((item) => item.id), payload.type);
  const remove: string[] = [];
  const insert: Exercise[] = [];
  for (const [index, content] of valid) {
    const item = items[index]!;
    const current = existing.find((exercise) => exercise.itemId === item.id);
    if (current && canonical(current.content) === canonical(content)) continue;
    if (current) remove.push(current.id);
    insert.push({ id: deps.idGenerator.next(), itemId: item.id, userId: ctx.userId, type: payload.type, content, createdAt: ctx.now.toISOString() });
  }
  if (remove.length > 0 || insert.length > 0) await deps.repo.applyExercises(ctx.userId, { remove, insert });
  return ok(undefined);
}
