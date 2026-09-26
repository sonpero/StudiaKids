import { useQuery } from "@tanstack/react-query";
import { getProgress, starsLabel } from "../lib/progress.js";

// Shared by every counter on screen; each answer writes its new progress
// here (GameScreen), so the counter moves without reading again.
export const PROGRESS_QUERY_KEY = ["progress"];

// docs/ui.md, M5: a star and the total, never a loss, never a comparison.
// Nothing while unknown: a counter never guesses.
export function StarCounter() {
  const progress = useQuery({ queryKey: PROGRESS_QUERY_KEY, queryFn: () => getProgress() });
  if (!progress.data) return null;
  const { total } = progress.data;
  return (
    <p
      data-testid="star-counter"
      aria-label={starsLabel(total)}
      className="flex items-center gap-1 font-[family-name:var(--font-display)] text-[20px] font-bold text-[var(--color-ink)]"
    >
      <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" focusable="false">
        <path
          d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"
          fill="var(--color-soleil)"
          stroke="var(--color-ink)"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
      <span aria-hidden="true">{total}</span>
    </p>
  );
}
