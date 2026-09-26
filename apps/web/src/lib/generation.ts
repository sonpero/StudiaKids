import { generationStatusSchema, type GenerationStatusDto } from "@studiakids/contracts";
import { HttpError } from "./http-error.js";

// « Créer mes jeux » (docs/modules/exercise-generator.md): the same 202 and
// current status however many times it is tapped.
export async function startGeneration(courseId: string): Promise<GenerationStatusDto> {
  const res = await fetch(`/api/courses/${courseId}/generate`, { method: "POST" });
  if (!res.ok) throw new HttpError(res.status, "POST /api/courses/:id/generate");
  return generationStatusSchema.parse(await res.json());
}

// A 404 is a course deleted meanwhile: null, never an error.
export async function getGenerationStatus(courseId: string): Promise<GenerationStatusDto | null> {
  const res = await fetch(`/api/courses/${courseId}/generation-status`);
  if (res.status === 404) return null;
  if (!res.ok) throw new HttpError(res.status, "GET /api/courses/:id/generation-status");
  return generationStatusSchema.parse(await res.json());
}

const SLOW_AFTER_MS = 30_000;

// docs/ui.md, "Travail asynchrone": same pace as the extraction's.
export function generationPollInterval(status: GenerationStatusDto["status"], elapsedMs: number): number | false {
  if (status !== "splitting" && status !== "generating") return false;
  return elapsedMs < SLOW_AFTER_MS ? 1000 : 5000;
}
