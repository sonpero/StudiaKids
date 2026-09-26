import { answerResponseSchema, playableListResponseSchema, type AnswerResponseDto, type ComparisonResultDto, type GameType, type PlayableListDto } from "@studiakids/contracts";
import { HttpError } from "./http-error.js";

// A 404 is a course deleted meanwhile: null, and the screen goes home.
export async function listPlayableExercises(courseId: string): Promise<PlayableListDto | null> {
  const res = await fetch(`/api/courses/${courseId}/exercises`);
  if (res.status === 404) return null;
  if (!res.ok) throw new HttpError(res.status, "GET /api/courses/:id/exercises");
  return playableListResponseSchema.parse(await res.json());
}

export type Correction = NonNullable<AnswerResponseDto["correction"]>;

// The units, and after a wrong answer the right one (M4 closing decision).
export async function answerExercise(exerciseId: string, givenAnswer: unknown, reread: boolean): Promise<ComparisonResultDto & { correction?: Correction }> {
  const res = await fetch(`/api/exercises/${exerciseId}/answer`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ givenAnswer, reread }),
  });
  if (!res.ok) throw new HttpError(res.status, "POST /api/exercises/:id/answer");
  const { result, correction } = answerResponseSchema.parse(await res.json());
  return correction === undefined ? result : { ...result, correction };
}

// docs/ui.md, "Jouer (M4)": « Dictée flash » is decided, the others « à valider ».
const LABELS: Record<GameType, string> = {
  mcq: "Quiz",
  true_false: "Vrai ou faux",
  matching: "Relie les paires",
  reordering: "Remets dans l'ordre",
  cloze: "Texte à trous",
  mental_math: "Calcul flash",
  delayed_copy: "Dictée flash",
};

export const gameLabel = (type: GameType) => LABELS[type];
