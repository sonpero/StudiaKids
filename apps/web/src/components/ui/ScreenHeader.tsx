import { StarCounter } from "../StarCounter.js";
import { iconButton } from "./styles.js";

export type HeaderBack = { label: string; icon: "close" | "back"; onClick: () => void };

const ICONS = {
  close: <path d="M6 6l12 12M18 6 6 18" />,
  back: <path d="M15 5l-7 7 7 7" />,
};

// docs/design/tuteur.png, flash.png, saisie.png: a square button on the
// left, the title centred, the star pill on the right.
export function ScreenHeader({ title, back }: { title: string; back?: HeaderBack }) {
  return (
    <header className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-2">
      {back ? (
        <button type="button" aria-label={back.label} onClick={back.onClick} className={iconButton}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
            {ICONS[back.icon]}
          </svg>
        </button>
      ) : (
        <span className="w-11" />
      )}
      <h1 className="text-center font-display text-sous-titre font-bold text-ink">{title}</h1>
      <StarCounter />
    </header>
  );
}
