import type { CourseDto } from "@studiakids/contracts";

type Subject = NonNullable<CourseDto["subject"]>;

// docs/glossaire.md, "Matières": identifiers in English, labels in French.
const LABELS: Record<Subject, string> = {
  maths: "Maths",
  french: "Français",
  history: "Histoire",
  geography: "Géographie",
  science: "Sciences",
  english: "Anglais",
  other: "Autre",
};

export function subjectLabel(subject: Subject): string {
  return LABELS[subject];
}
