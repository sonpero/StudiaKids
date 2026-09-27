import { sizeProps, type PoseProps } from "./size.js";
// Traced literally from docs/design/mascotte-etats.html's `waiting` pose
// (docs/ui.md, "La mascotte": the paths are never redrawn).
export function Waiting({ motion, size }: PoseProps) {
  return (
    <svg viewBox="0 0 140 140" {...sizeProps(size)} aria-hidden="true" focusable="false" data-testid="mascot" data-pose="waiting" data-motion={motion}>
      <path className="stroke-ink" d="M70 46 V26" strokeWidth="4" strokeLinecap="round" />
      <ellipse className="fill-succes stroke-ink" cx="86" cy="22" rx="15" ry="8" strokeWidth="4" transform="rotate(-18 86 22)" />
      <ellipse className="fill-soleil stroke-ink" cx="24" cy="92" rx="12" ry="8" strokeWidth="4" transform="rotate(-22 24 92)" />
      <ellipse className="fill-soleil stroke-ink" cx="116" cy="92" rx="12" ry="8" strokeWidth="4" transform="rotate(22 116 92)" />
      <ellipse className="fill-soleil stroke-ink" cx="70" cy="88" rx="46" ry="42" strokeWidth="4" />
      <path className="stroke-ink" d="M48 78 q8 -8 16 0" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path className="stroke-ink" d="M76 78 q8 -8 16 0" strokeWidth="4" fill="none" strokeLinecap="round" />
      <ellipse className="fill-joue" cx="42" cy="96" rx="7" ry="4.5" opacity="0.55" />
      <ellipse className="fill-joue" cx="98" cy="96" rx="7" ry="4.5" opacity="0.55" />
      <path className="stroke-ink" d="M60 96 q10 9 20 0" strokeWidth="4" fill="none" strokeLinecap="round" />
    </svg>
  );
}
