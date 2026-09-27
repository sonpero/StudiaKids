import type { CourseDto } from "@studiakids/contracts";
import { subjectLabel } from "../../lib/subjects.js";

// docs/design/accueil.png: the subject's pastel square with its first two
// letters. Decorative: the card says the subject in words.
export function SubjectChip({ subject, color }: { subject: CourseDto["subject"]; color: string }) {
  return (
    <span
      aria-hidden="true"
      data-subject-chip
      style={{ backgroundColor: `var(--${color})` }}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-bouton border-3 border-ink font-display text-corps-l font-bold text-ink"
    >
      {subject ? subjectLabel(subject).slice(0, 2) : ""}
    </span>
  );
}
