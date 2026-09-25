export const SUBJECTS = ["maths", "french", "history", "geography", "science", "english", "other"] as const;
export type Subject = (typeof SUBJECTS)[number];

// Values are design token names (--matiere-*), French on purpose: see
// docs/glossaire.md, "Exceptions assumées".
const SUBJECT_COLORS: Record<Subject, string> = {
  maths: "matiere-maths",
  french: "matiere-francais",
  history: "matiere-histoire",
  geography: "matiere-geographie",
  science: "matiere-sciences",
  english: "matiere-anglais",
  other: "matiere-autre",
};

export function subjectColor(subject: Subject): string {
  return SUBJECT_COLORS[subject];
}
