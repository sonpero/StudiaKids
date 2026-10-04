import { err, ok, type Result } from "../../shared/index.js";
import type { GameType } from "../domain/game-types.js";
import { generateForType, type HandleGenerationJobDeps } from "./handle-generation-job.js";

export type RegenerateCourseDeps = HandleGenerationJobDeps;

// Every game type on the course's items, once each, for the whole course,
// under today's prompts and per-subject rules; no job and no new split
// (docs/modules/exercise-generator.md, "Régénérer un cours déjà généré").
// A type whose call fails is reported and the others carry on.
export async function regenerateCourse(deps: RegenerateCourseDeps, userId: string, courseId: string, now: Date): Promise<Result<{ types: GameType[]; failed: GameType[] }, "not-found" | "not-ready">> {
  const text = await deps.courses.read(userId, courseId);
  if (!text.ok) return err(text.error);
  const types: GameType[] = [];
  for (const item of await deps.repo.listItems(userId, courseId)) for (const type of item.applicableGameTypes) if (!types.includes(type)) types.push(type);
  const failed: GameType[] = [];
  for (const type of types) if (!(await generateForType(deps, userId, { courseId, type }, now)).ok) failed.push(type);
  return ok({ types, failed });
}
