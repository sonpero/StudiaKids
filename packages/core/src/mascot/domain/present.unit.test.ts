import { describe, expect, it } from "vitest";
import { ALL_LINES, DEFAULT_PRESENTATION, MASCOT_POSES, present, type MascotPose, type Signal } from "./present.js";

// The executable form of the signal -> pose table in docs/modules/mascot.md.
const TABLE: [Signal, MascotPose][] = [
  [{ type: "home", hasExistingCourses: false }, "idle"],
  [{ type: "home", hasExistingCourses: true }, "idle"],
  [{ type: "extraction-in-progress" }, "waiting"],
  [{ type: "extraction-illegible", reason: "trop flou" }, "sorry"],
  [{ type: "extraction-not-a-course-page" }, "sorry"],
  [{ type: "extraction-failed" }, "glitch"],
  [{ type: "generation-in-progress" }, "waiting"],
  [{ type: "generation-failed" }, "glitch"],
  [{ type: "game-from-excerpt-in-progress" }, "waiting"],
  [{ type: "game-answer", correct: true, streakBonus: false }, "joy"],
  [{ type: "game-answer", correct: true, streakBonus: true }, "joy"],
  [{ type: "game-answer", correct: false, streakBonus: false }, "waiting"],
  [{ type: "session-complete", starsEarned: 3 }, "joy"],
  [{ type: "tutor-thinking" }, "waiting"],
  [{ type: "tutor-refusal" }, "refusal"],
];

describe("present", () => {
  it.each(TABLE)("maps %j to the %s pose", (signal, pose) => {
    expect(present(signal, 0).pose).toBe(pose);
  });

  it("only ever returns one of the seven poses", () => {
    expect(MASCOT_POSES).toEqual(["idle", "watching", "waiting", "joy", "sorry", "glitch", "refusal"]);
    for (const [signal] of TABLE) {
      for (const variant of [0, 1, 2, 7]) expect(MASCOT_POSES).toContain(present(signal, variant).pose);
    }
  });

  it("falls back to idle and a neutral line for a value outside Signal, never throwing", () => {
    const unknown = { type: "brand-new-signal" } as unknown as Signal;

    expect(present(unknown, 0)).toEqual(DEFAULT_PRESENTATION);
    expect(DEFAULT_PRESENTATION.pose).toBe("idle");
    expect(present(null as unknown as Signal, 0)).toEqual(DEFAULT_PRESENTATION);
  });

  it("never answers a wrong game answer with joy, sorry or glitch, whatever the variant", () => {
    for (const variant of [0, 1, 2, 3, 99]) {
      const { pose } = present({ type: "game-answer", correct: false, streakBonus: false }, variant);
      expect(["joy", "sorry", "glitch"]).not.toContain(pose);
    }
  });

  it("keeps a photo problem (sorry) and a technical failure (glitch) apart", () => {
    expect(present({ type: "extraction-illegible", reason: "x" }, 0).pose).not.toBe(present({ type: "extraction-failed" }, 0).pose);
  });

  it("gives an illegible photo and a photo with no lesson the same pose but never the same line", () => {
    const illegible = present({ type: "extraction-illegible", reason: "x" }, 0);
    const notACourse = present({ type: "extraction-not-a-course-page" }, 0);

    expect(illegible.pose).toBe(notACourse.pose);
    expect(illegible.line).not.toBe(notACourse.line);
  });

  it("never shows the model's own reason to the child: it is unvetted text", () => {
    const { line } = present({ type: "extraction-illegible", reason: "EXIF blur detected by the model" }, 0);

    expect(line).not.toContain("EXIF");
  });

  it("tells a home with courses from an empty one by the line, not the drawing", () => {
    const empty = present({ type: "home", hasExistingCourses: false }, 0);
    const full = present({ type: "home", hasExistingCourses: true }, 0);

    expect(empty.pose).toBe(full.pose);
    expect(empty.line).not.toBe(full.line);
  });

  it("tells a streak bonus from a plain right answer by the line", () => {
    expect(present({ type: "game-answer", correct: true, streakBonus: true }, 0).line).not.toBe(
      present({ type: "game-answer", correct: true, streakBonus: false }, 0).line,
    );
  });

  it("counts the stars earned in the session, with French plural agreement", () => {
    expect(present({ type: "session-complete", starsEarned: 1 }, 0).line).toContain("1 étoile");
    expect(present({ type: "session-complete", starsEarned: 1 }, 0).line).not.toContain("étoiles");
    expect(present({ type: "session-complete", starsEarned: 4 }, 0).line).toContain("4 étoiles");
  });

  it("never mentions zero stars: finishing a session is never framed as a loss", () => {
    expect(present({ type: "session-complete", starsEarned: 0 }, 0).line).not.toMatch(/\b0\b|aucune|zéro/i);
  });

  it("is deterministic: same signal and variant, same result", () => {
    for (const [signal] of TABLE) {
      expect(present(signal, 5)).toEqual(present(signal, 5));
    }
  });

  it("accepts any variant index, cycling through the signal's own lines instead of failing", () => {
    for (const [signal] of TABLE) {
      const ownLines = new Set(Array.from({ length: 12 }, (_, i) => present(signal, i).line));
      for (const variant of [-1, 1000, 2.5, Number.NaN, Number.POSITIVE_INFINITY]) {
        const { line } = present(signal, variant);
        expect(ownLines).toContain(line);
        expect(line).not.toBe(DEFAULT_PRESENTATION.line);
      }
    }
  });
});

describe("line catalogue", () => {
  const FORBIDDEN = [
    "extraction",
    "job",
    "génération",
    "generation",
    "backend",
    "serveur",
    "server",
    "erreur",
    "error",
    "500",
    "bug",
    "api",
    "modèle",
    "llm",
    "upload",
    "timeout",
  ];

  it("contains no technical jargon, in any line", () => {
    expect(ALL_LINES.length).toBeGreaterThan(TABLE.length);
    for (const line of ALL_LINES) {
      for (const word of FORBIDDEN) expect(line.toLowerCase(), line).not.toMatch(new RegExp(`\\b${word}\\b`));
    }
  });

  it("never makes the mascot claim a feeling or a memory (docs/securite.md)", () => {
    for (const line of ALL_LINES) {
      expect(line, line).not.toMatch(/je (suis|me sens) (triste|content|déçu|heureux)|tu m'as manqué|je t'attendais|je pense|je ressens/i);
    }
  });
});

// M3 (docs/modules/mascot.md): the end of a generation, both ways.
describe("present, generation outcomes", () => {
  it("games ready: joy, and the catalogue's sentence", () => {
    expect(present({ type: "generation-ready" }, 0)).toEqual({ pose: "joy", line: "Tes jeux sont prêts !" });
  });

  it("a lesson too short: sorry — a problem of the photo, never of the child — and an invitation to take another", () => {
    const { pose, line } = present({ type: "generation-insufficient-coverage" }, 0);

    expect(pose).toBe("sorry");
    expect(line).toBe("Cette photo est un peu courte pour faire des jeux. On en prend une autre ?");
    expect(ALL_LINES).toContain(line);
  });
});
