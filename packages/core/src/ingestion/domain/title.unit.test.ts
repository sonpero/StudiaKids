import { describe, expect, it } from "vitest";
import { COURSE_TITLE_MAX_CHARS, COURSE_TITLE_MIN_CHARS, isValidCourseTitle, startsWithLessonCode, stripLessonCode } from "./title.js";

// Decided at M2 (2026-09-26), after a real lesson failed: titles are the
// lesson's own, often longer than three words, bounded in characters like
// item titles (docs/modules/exercise-generator.md), never led by a code.
describe("course title bounds", () => {
  it("are the item titles' own: 3 to 60 characters", () => {
    expect([COURSE_TITLE_MIN_CHARS, COURSE_TITLE_MAX_CHARS]).toEqual([3, 60]);
  });

  it("accept a real lesson title of five words", () => {
    expect(isValidCourseTitle("Revoir les nombres jusqu'à 9999")).toBe(true);
  });

  it("count characters after trimming, at both ends of the range", () => {
    expect(isValidCourseTitle("  Air ")).toBe(true);
    expect(isValidCourseTitle("Ai")).toBe(false);
    expect(isValidCourseTitle("a".repeat(60))).toBe(true);
    expect(isValidCourseTitle("a".repeat(61))).toBe(false);
  });

  it("refuse a title led by a lesson code or number", () => {
    expect(isValidCourseTitle("NUM1 – Revoir les nombres jusqu'à 9999")).toBe(false);
  });
});

describe("lesson codes", () => {
  const cases: [string, string][] = [
    ["NUM1 – Revoir les nombres jusqu'à 9999", "Revoir les nombres jusqu'à 9999"],
    ["NB4 - Les grands nombres", "Les grands nombres"],
    ["Leçon 3 : Le verbe", "Le verbe"],
    ["leçon n°12. Les fractions", "Les fractions"],
    ["Chapitre 2 – Les fleuves", "Les fleuves"],
    ["Séquence 1) La Gaule", "La Gaule"],
    ["CM1 — Le passé composé", "Le passé composé"],
  ];
  for (const [raw, clean] of cases) {
    it(`strips « ${raw} » to « ${clean} »`, () => {
      expect(startsWithLessonCode(raw)).toBe(true);
      expect(stripLessonCode(raw)).toBe(clean);
    });
  }

  it("leaves a title that merely contains a number alone", () => {
    for (const title of ["Les 3 petits cochons", "Revoir les nombres jusqu'à 9999", "1914 – 1918 : la Grande Guerre", "Le verbe"]) {
      expect(startsWithLessonCode(title)).toBe(false);
      expect(stripLessonCode(title)).toBe(title);
    }
  });
});
