import { present } from "@studiakids/mascot";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Mascot } from "../components/mascot/Mascot.js";
import { getProgress } from "../lib/progress.js";
import { primary, secondary, text } from "./games/styles.js";

export interface SessionSummaryProps {
  since: string;
  onMore: () => void;
  onHome: () => void;
}

// docs/ui.md, M5: the end of a game session — only gains and right
// answers (helped ones included), never a mistake, never a comparison.
export function SessionSummary({ since, onMore, onHome }: SessionSummaryProps) {
  const summary = useQuery({ queryKey: ["progress", "since", since], queryFn: () => getProgress(since) });
  const [variant] = useState(() => Math.floor(Math.random() * 2));

  let content;
  if (summary.isError) {
    content = (
      <>
        <Mascot pose="glitch" />
        <p className={text}>Oh, quelque chose a coincé. On réessaie ?</p>
        <button type="button" onClick={() => void summary.refetch()} className={secondary}>
          Réessaie
        </button>
      </>
    );
  } else if (!summary.data) {
    content = (
      <>
        <Mascot pose="waiting" />
        <p className={text}>Je compte tes étoiles…</p>
      </>
    );
  } else {
    const stars = summary.data.starsSince ?? 0;
    const successes = summary.data.successesSince ?? 0;
    const { pose, line } = present({ type: "session-complete", starsEarned: stars }, variant);
    content = (
      <>
        <Mascot pose={pose} />
        <p className="font-[family-name:var(--font-display)] text-[20px] font-bold text-[var(--color-ink)]">{line}</p>
        {successes > 0 && <p className={text}>{successes === 1 ? "1 bonne réponse" : `${String(successes)} bonnes réponses`}</p>}
        <button type="button" onClick={onMore} className={primary}>
          Encore des jeux
        </button>
        <button type="button" onClick={onHome} className={secondary}>
          Accueil
        </button>
      </>
    );
  }

  return <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center gap-4 px-4 pt-6 pb-[96px] text-center">{content}</main>;
}
