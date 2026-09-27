export type Range = { start: number; end: number };

// A tutor citation is a section of the lesson's Markdown: its paragraphs,
// trimmed and joined by a single blank line (tutor's splitIntoSections).
// Found back from its first paragraph to the end of its last, so a blank
// line of a different width in the lesson does not lose it.
function locate(markdown: string, passage: string): Range | null {
  const paragraphs = passage
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== "");
  const first = paragraphs[0];
  const last = paragraphs.at(-1);
  if (first === undefined || last === undefined) return null;
  const start = markdown.indexOf(first);
  if (start < 0) return null;
  const lastAt = markdown.indexOf(last, start);
  if (lastAt < 0) return null;
  return { start, end: lastAt + last.length };
}

// In the lesson's order, overlapping ones merged; a passage not found (the
// lesson changed since) is left out rather than guessed.
export function locatePassages(markdown: string, passages: string[]): Range[] {
  const ranges = passages.flatMap((passage) => locate(markdown, passage) ?? []).sort((a, b) => a.start - b.start);
  const merged: Range[] = [];
  for (const range of ranges) {
    const previous = merged.at(-1);
    if (previous && range.start <= previous.end) previous.end = Math.max(previous.end, range.end);
    else merged.push({ ...range });
  }
  return merged;
}
