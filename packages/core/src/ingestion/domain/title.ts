// A course title is the lesson's own title as written on the page. Real
// titles often run past three words (« Revoir les nombres jusqu'à 9999 »),
// so they are bounded in characters, like item titles
// (docs/modules/exercise-generator.md).
export const COURSE_TITLE_MIN_CHARS = 3;
export const COURSE_TITLE_MAX_CHARS = 60;

// A code or number leading a title: « NUM1 – », « NB4 - », « Leçon 3 : »,
// « Chapitre 2 – », « CM1 — ». Only at the start and only before a
// separator, so « Les 3 petits cochons » or « 1914 – 1918 » stay whole.
const LESSON_CODE =
  /^\s*(?:[A-Z]{1,5}\s?\d+[a-z]?|(?:leçon|lecon|chapitre|séquence|sequence|séance|seance|unité|unite|partie|fiche)\s*(?:n°|no\.?)?\s*\d+)\s*[–—\-:.)]\s*/iu;

export function startsWithLessonCode(title: string): boolean {
  return LESSON_CODE.test(title);
}

export function stripLessonCode(title: string): string {
  return title.replace(LESSON_CODE, "").trim();
}

export function isValidCourseTitle(title: string): boolean {
  const trimmed = title.trim();
  return trimmed.length >= COURSE_TITLE_MIN_CHARS && trimmed.length <= COURSE_TITLE_MAX_CHARS && !startsWithLessonCode(trimmed);
}
