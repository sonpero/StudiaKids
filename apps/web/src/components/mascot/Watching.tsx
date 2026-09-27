import { sizeProps, type PoseProps } from "./size.js";
// Traced literally from docs/design/mascotte-etats.html's `watching` pose
// (docs/ui.md, "La mascotte": the paths are never redrawn).
export function Watching({ motion, size }: PoseProps) {
  return (
    <svg viewBox="0 0 140 140" {...sizeProps(size)} aria-hidden="true" focusable="false" data-testid="mascot" data-pose="watching" data-motion={motion}>
      <g transform="rotate(-5 70 90)">
        <path className="stroke-ink" d="M70 46 V26" strokeWidth="4" strokeLinecap="round" />
        <ellipse className="fill-succes stroke-ink" cx="86" cy="22" rx="15" ry="8" strokeWidth="4" transform="rotate(-18 86 22)" />
        <ellipse className="fill-soleil stroke-ink" cx="24" cy="92" rx="12" ry="8" strokeWidth="4" transform="rotate(-22 24 92)" />
        <ellipse className="fill-soleil stroke-ink" cx="112" cy="70" rx="12" ry="8" strokeWidth="4" transform="rotate(-42 112 70)" />
        <ellipse className="fill-soleil stroke-ink" cx="70" cy="88" rx="46" ry="42" strokeWidth="4" />
        <circle className="fill-ink" cx="56" cy="80" r="9" />
        <circle className="fill-ink" cx="84" cy="80" r="9" />
        <circle className="fill-canvas" cx="59.4" cy="76.6" r="3" />
        <circle className="fill-canvas" cx="87.4" cy="76.6" r="3" />
        <ellipse className="fill-joue" cx="42" cy="98" rx="7" ry="4.5" opacity="0.55" />
        <ellipse className="fill-joue" cx="98" cy="98" rx="7" ry="4.5" opacity="0.55" />
        <circle className="stroke-ink" cx="70" cy="101" r="5" fill="none" strokeWidth="4" />
      </g>
    </svg>
  );
}
