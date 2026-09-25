// A primary-school lesson fits on one or two pages; five leaves room
// without opening the door to thirty-photo courses (docs/modules/ingestion.md).
export const MAX_PAGES_PER_COURSE = 5;

// Pages are never removed one by one (only a whole course is deleted), so
// existing indices are always exactly [0..n-1] and the next one is the count.
export function nextPageIndex(existing: number[]): number {
  return existing.length;
}

export function canAddPage(pageCount: number): boolean {
  return pageCount < MAX_PAGES_PER_COURSE;
}
