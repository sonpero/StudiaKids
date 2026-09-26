import type { CourseNameSuggestion } from "./ports.js";
import type { Subject } from "./subject.js";
import { COURSE_TITLE_MAX_CHARS, isValidCourseTitle, stripLessonCode } from "./title.js";

// Proposed in docs/ui.md, "à valider": shown only when the page has no
// usable # heading and the namer gave no valid title.
export const FALLBACK_COURSE_TITLE = "Mon cours";

// Cut at a word boundary, the ellipsis included in the limit.
function truncate(title: string): string {
  if (title.length <= COURSE_TITLE_MAX_CHARS) return title;
  const cut = title.slice(0, COURSE_TITLE_MAX_CHARS - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

// The extraction's first # heading is the lesson's title (docs/modules/
// ingestion.md, "Forme du Markdown"), cleaned of its code and truncated.
export function titleFromMarkdown(markdown: string): string {
  const heading = /^# (.+)$/m.exec(markdown)?.[1];
  const title = heading === undefined ? "" : truncate(stripLessonCode(heading));
  return isValidCourseTitle(title) ? title : FALLBACK_COURSE_TITLE;
}

// Naming never fails a course (decided 2026-09-26): each invalid field is
// replaced on its own, a valid one is always kept. `null` is a namer that
// gave nothing usable at all.
export function resolveCourseName(proposal: CourseNameSuggestion | null, markdown: string): { title: string; subject: Subject } {
  const title = proposal?.title != null && isValidCourseTitle(proposal.title) ? proposal.title.trim() : titleFromMarkdown(markdown);
  return { title, subject: proposal?.subject ?? "other" };
}
