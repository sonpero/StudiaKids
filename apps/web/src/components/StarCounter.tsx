import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { getProgress, starsLabel } from "../lib/progress.js";

// Shared by every counter on screen; each answer writes its new progress
// here (GameScreen), so the counter moves without reading again.
export const PROGRESS_QUERY_KEY = ["progress"];

// docs/ui.md, M5: a star and the total, never a loss, never a comparison;
// drawn as the mockups' sun pill.
// Nothing while unknown: a counter never guesses.
export function StarCounter() {
  const progress = useQuery({ queryKey: PROGRESS_QUERY_KEY, queryFn: () => getProgress() });
  const total = progress.data?.total;
  // The star bounces when the total rises (styles/motion.css), never when it stays.
  const previous = useRef<number | undefined>(undefined);
  const [bounce, setBounce] = useState(0);
  useEffect(() => {
    if (total !== undefined && previous.current !== undefined && total > previous.current) setBounce((n) => n + 1);
    previous.current = total;
  }, [total]);
  if (total === undefined) return null;
  return (
    <p
      key={bounce}
      data-testid="star-counter"
      data-bounce={bounce > 0 ? "" : undefined}
      // aria-label is not allowed on a paragraph: the star and its number
      // read as one image, « 3 étoiles ».
      role="img"
      aria-label={starsLabel(total)}
      className="flex items-center gap-1 rounded-pastille border-3 border-ink bg-soleil px-3 py-1 font-display text-corps-l font-bold text-ink shadow-petite"
    >
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
        <path className="stroke-ink" d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" fill="none" strokeWidth="2" strokeLinejoin="round" />
      </svg>
      <span aria-hidden="true">{total}</span>
    </p>
  );
}
