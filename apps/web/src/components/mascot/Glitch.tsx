import { sizeProps, type PoseProps } from "./size.js";
// PROVISIONAL: traced from docs/design/mascotte-glitch-provisoire.svg, a
// draft derived from idle's paths until the final drawing lands in
// docs/design/ (M2 debt, docs/jalons.md). A harmless breakdown, no drama.
export function Glitch({ motion, size }: PoseProps) {
  return (
    <svg viewBox="0 0 140 140" {...sizeProps(size)} aria-hidden="true" focusable="false" data-testid="mascot" data-pose="glitch" data-motion={motion}>
      <path className="stroke-ink" d="M70 46 V36 L80 28" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <ellipse className="fill-succes stroke-ink" cx="88" cy="34" rx="15" ry="8" strokeWidth="4" transform="rotate(38 88 34)" />
      <path className="stroke-ink" d="M104 14 l-6 8 h7 l-6 9" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <ellipse className="fill-soleil stroke-ink" cx="24" cy="92" rx="12" ry="8" strokeWidth="4" transform="rotate(-22 24 92)" />
      <ellipse className="fill-soleil stroke-ink" cx="116" cy="92" rx="12" ry="8" strokeWidth="4" transform="rotate(22 116 92)" />
      <ellipse className="fill-soleil stroke-ink" cx="70" cy="88" rx="46" ry="42" strokeWidth="4" />
      <circle className="fill-ink" cx="56" cy="80" r="7" />
      <circle className="fill-canvas" cx="58.6" cy="77.4" r="2.4" />
      <circle className="fill-ink" cx="85" cy="76" r="4.5" />
      <circle className="fill-canvas" cx="86.6" cy="74.4" r="1.6" />
      <ellipse className="fill-joue" cx="42" cy="96" rx="7" ry="4.5" opacity="0.55" />
      <ellipse className="fill-joue" cx="98" cy="96" rx="7" ry="4.5" opacity="0.55" />
      <path className="stroke-ink" d="M62 101 L78 99" strokeWidth="4" fill="none" strokeLinecap="round" />
    </svg>
  );
}
