import { describe, expect, it } from "vitest";
import { FALLBACK_COURSE_TITLE, resolveCourseName, titleFromMarkdown } from "./course-name.js";

// Decided at M2 (2026-09-26): naming never fails a course. After the
// namer's retry, each invalid field is replaced on its own; a valid one is
// always kept.
describe("resolveCourseName", () => {
  const markdown = "Français – Leçon 3\n\n# NUM1 – Revoir les nombres jusqu'à 9999\n\n## Écrire un nombre";

  it("keeps both fields when both are valid", () => {
    expect(resolveCourseName({ title: "Le verbe", subject: "french" }, markdown)).toEqual({ title: "Le verbe", subject: "french" });
  });

  it("an invalid title becomes the extraction's first #, cleaned of its code; a valid subject is kept", () => {
    expect(resolveCourseName({ title: null, subject: "maths" }, markdown)).toEqual({ title: "Revoir les nombres jusqu'à 9999", subject: "maths" });
  });

  it("an invalid subject becomes other; a valid title is kept", () => {
    expect(resolveCourseName({ title: "Le verbe", subject: null }, markdown)).toEqual({ title: "Le verbe", subject: "other" });
  });

  it("no proposal at all (the namer failed): both fields fall back", () => {
    expect(resolveCourseName(null, markdown)).toEqual({ title: "Revoir les nombres jusqu'à 9999", subject: "other" });
  });

  it("a title that breaks the rules is treated as invalid, whoever proposed it", () => {
    expect(resolveCourseName({ title: "Leçon 3 : Le verbe", subject: "french" }, markdown).title).toBe("Revoir les nombres jusqu'à 9999");
    expect(resolveCourseName({ title: "x".repeat(61), subject: "french" }, markdown).title).toBe("Revoir les nombres jusqu'à 9999");
  });
});

describe("titleFromMarkdown", () => {
  it("takes the first # heading, never a ## one", () => {
    expect(titleFromMarkdown("## Partie 1\n\n# Les fractions\n\n# Autre")).toBe("Les fractions");
  });

  it("truncates a long heading to 60 characters, at a word boundary", () => {
    const title = titleFromMarkdown("# Les fractions, les nombres décimaux et leur place exacte sur la droite graduée");
    expect(title.length).toBeLessThanOrEqual(60);
    expect(title).toBe("Les fractions, les nombres décimaux et leur place exacte…");
  });

  it("falls back to a neutral title when there is no usable # heading", () => {
    expect(titleFromMarkdown("## Seulement des parties")).toBe(FALLBACK_COURSE_TITLE);
    expect(titleFromMarkdown("# NUM1 – ")).toBe(FALLBACK_COURSE_TITLE);
    expect(FALLBACK_COURSE_TITLE).toBe("Mon cours");
  });
});
