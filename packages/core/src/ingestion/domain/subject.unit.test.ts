import { describe, expect, it } from "vitest";
import { SUBJECTS, subjectColor } from "./subject.js";

describe("subjectColor", () => {
  it("maps every subject of the closed list to its pastel token name", () => {
    expect(Object.fromEntries(SUBJECTS.map((subject) => [subject, subjectColor(subject)]))).toEqual({
      maths: "matiere-maths",
      french: "matiere-francais",
      history: "matiere-histoire",
      geography: "matiere-geographie",
      science: "matiere-sciences",
      english: "matiere-anglais",
      other: "matiere-autre",
    });
  });

  it("gives each subject its own color", () => {
    expect(new Set(SUBJECTS.map(subjectColor)).size).toBe(SUBJECTS.length);
  });
});
