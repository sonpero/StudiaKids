// Closed list, docs/ui.md "La mascotte". `sorry` and `glitch` qualify a
// problem of the system (a photo, a failure), never a child's answer.
export const MASCOT_POSES = ["idle", "watching", "waiting", "joy", "sorry", "glitch", "refusal"] as const;
export type MascotPose = (typeof MASCOT_POSES)[number];

export type Signal =
  | { type: "home"; hasExistingCourses: boolean }
  | { type: "extraction-in-progress" }
  | { type: "extraction-illegible"; reason: string }
  | { type: "extraction-not-a-course-page" }
  | { type: "extraction-failed" }
  | { type: "generation-in-progress" }
  | { type: "generation-ready" }
  | { type: "generation-insufficient-coverage" }
  | { type: "generation-failed" }
  | { type: "game-from-excerpt-in-progress" }
  | { type: "game-answer"; correct: boolean; streakBonus: boolean }
  | { type: "session-complete"; starsEarned: number }
  | { type: "tutor-thinking" }
  | { type: "tutor-refusal" };

export type Presentation = { pose: MascotPose; line: string };

export const DEFAULT_PRESENTATION: Presentation = { pose: "idle", line: "Coucou !" };

// Several lines per signal so a child who plays long does not hear the same
// sentence every time. Tutoiement, short, concrete, no jargon (docs/ui.md,
// "Copie"); never a feeling or a memory (docs/securite.md).
const LINES = {
  homeEmpty: ["Aucun cours pour l'instant, on en photographie un ?", "Prends ta leçon en photo, et on joue !"],
  homeWithCourses: ["On reprend un cours ?", "Choisis un cours, ou photographie-en un nouveau !"],
  extractionInProgress: ["Je regarde ta photo…", "Je lis ta leçon…"],
  // The model's own reason is never shown: it is unvetted, possibly
  // technical text. The line stays the catalogue's.
  illegible: ["Oups, la photo est un peu floue. On la reprend ?", "Je n'arrive pas à bien lire. On refait la photo ?"],
  notACoursePage: ["Je ne vois pas de leçon sur cette photo. On essaie encore ?", "Hum, ce n'est pas une page de cours. On reprend la photo ?"],
  extractionFailed: ["Oh, quelque chose a coincé. On réessaie ?", "Ça n'a pas marché cette fois. On recommence ?"],
  generationInProgress: ["Je prépare tes jeux…", "Tes jeux arrivent…"],
  // Validated 2026-09-26 (docs/ui.md, M3).
  generationReady: ["Tes jeux sont prêts !"],
  insufficientCoverage: ["Cette photo est un peu courte pour faire des jeux. On en prend une autre ?"],
  generationFailed: ["Tes jeux ne sont pas prêts. On réessaie ?", "Oh, les jeux ont coincé. On recommence ?"],
  gameFromExcerptInProgress: ["Je te prépare un jeu sur ce passage…"],
  correct: ["Bravo !", "Bien joué !", "C'est ça !"],
  streakBonus: ["Super série !", "Quelle série, bravo !"],
  // Calm and encouraging, never a verdict (CLAUDE.md rule 7).
  incorrect: ["Pas tout à fait. Essaie encore !", "Presque ! On continue ?"],
  tutorThinking: ["Je cherche dans ton cours…"],
  // Exact wording from docs/securite.md.
  tutorRefusal: ["Je ne peux pas répondre à ça, je ne connais que ton cours."],
} satisfies Record<string, string[]>;

function sessionCompleteLine(starsEarned: number): string {
  // Finishing is never framed as a loss: zero stars is not mentioned.
  if (starsEarned <= 0) return "Bien joué, tu as fini !";
  if (starsEarned === 1) return "Bravo, tu as gagné 1 étoile !";
  return `Bravo, tu as gagné ${String(starsEarned)} étoiles !`;
}

// For the jargon test: every fixed line, plus each shape of the computed one.
export const ALL_LINES: readonly string[] = [
  ...Object.values(LINES).flat(),
  DEFAULT_PRESENTATION.line,
  sessionCompleteLine(0),
  sessionCompleteLine(1),
  sessionCompleteLine(2),
];

// variantIndex is supplied by the caller (e.g. how many times the signal
// appeared this session): no hidden clock or randomness here. Any number
// is accepted and wraps around.
function pick(lines: readonly string[], variantIndex: number): string {
  const index = Math.trunc(variantIndex);
  const safe = Number.isFinite(index) ? index : 0;
  return lines[((safe % lines.length) + lines.length) % lines.length] ?? DEFAULT_PRESENTATION.line;
}

function presentKnown(signal: Signal, variantIndex: number): Presentation | null {
  switch (signal.type) {
    case "home":
      return { pose: "idle", line: pick(signal.hasExistingCourses ? LINES.homeWithCourses : LINES.homeEmpty, variantIndex) };
    case "extraction-in-progress":
      return { pose: "waiting", line: pick(LINES.extractionInProgress, variantIndex) };
    case "extraction-illegible":
      return { pose: "sorry", line: pick(LINES.illegible, variantIndex) };
    case "extraction-not-a-course-page":
      return { pose: "sorry", line: pick(LINES.notACoursePage, variantIndex) };
    case "extraction-failed":
      return { pose: "glitch", line: pick(LINES.extractionFailed, variantIndex) };
    case "generation-in-progress":
      return { pose: "waiting", line: pick(LINES.generationInProgress, variantIndex) };
    case "generation-ready":
      return { pose: "joy", line: pick(LINES.generationReady, variantIndex) };
    case "generation-insufficient-coverage":
      return { pose: "sorry", line: pick(LINES.insufficientCoverage, variantIndex) };
    case "generation-failed":
      return { pose: "glitch", line: pick(LINES.generationFailed, variantIndex) };
    case "game-from-excerpt-in-progress":
      return { pose: "waiting", line: pick(LINES.gameFromExcerptInProgress, variantIndex) };
    case "game-answer":
      if (!signal.correct) return { pose: "waiting", line: pick(LINES.incorrect, variantIndex) };
      return { pose: "joy", line: pick(signal.streakBonus ? LINES.streakBonus : LINES.correct, variantIndex) };
    case "session-complete":
      return { pose: "joy", line: sessionCompleteLine(signal.starsEarned) };
    case "tutor-thinking":
      return { pose: "waiting", line: pick(LINES.tutorThinking, variantIndex) };
    case "tutor-refusal":
      return { pose: "refusal", line: pick(LINES.tutorRefusal, variantIndex) };
    default:
      return null;
  }
}

// Defensive on purpose (docs/modules/mascot.md, robustness rule): a signal
// added elsewhere without updating this module, or a corrupted serialized
// value, yields idle and a neutral line — never an exception, never a
// blank screen.
export function present(signal: Signal, variantIndex: number): Presentation {
  if (typeof signal !== "object" || signal === null) return DEFAULT_PRESENTATION;
  return presentKnown(signal, variantIndex) ?? DEFAULT_PRESENTATION;
}
