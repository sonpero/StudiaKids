import { sizeProps, type PoseProps } from "./size.js";
// PROVISIONAL: traced from docs/design/mascotte-sorry-provisoire.svg, a
// draft derived from idle's paths until the final drawing lands in
// docs/design/ (M2 debt, docs/jalons.md). An embarrassed "oops", never sad.
export function Sorry({ motion, size }: PoseProps) {
  return (
    <svg viewBox="0 0 140 140" {...sizeProps(size)} aria-hidden="true" focusable="false" data-testid="mascot" data-pose="sorry" data-motion={motion}>
      <path className="stroke-ink" d="M70 46 V26" strokeWidth="4" strokeLinecap="round" />
      <ellipse className="fill-succes stroke-ink" cx="86" cy="22" rx="15" ry="8" strokeWidth="4" transform="rotate(-18 86 22)" />
      <ellipse className="fill-soleil stroke-ink" cx="24" cy="92" rx="12" ry="8" strokeWidth="4" transform="rotate(-22 24 92)" />
      <ellipse className="fill-soleil stroke-ink" cx="70" cy="88" rx="46" ry="42" strokeWidth="4" />
      <ellipse className="fill-soleil stroke-ink" cx="112" cy="56" rx="12" ry="8" strokeWidth="4" transform="rotate(-60 112 56)" />
      <path className="stroke-ink" d="M49 81 q7 -7 14 0" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path className="stroke-ink" d="M77 81 q7 -7 14 0" strokeWidth="4" fill="none" strokeLinecap="round" />
      <ellipse className="fill-joue" cx="42" cy="96" rx="7" ry="4.5" opacity="0.75" />
      <ellipse className="fill-joue" cx="98" cy="96" rx="7" ry="4.5" opacity="0.75" />
      <path className="stroke-ink" d="M60 101 q5 -4 10 0 q5 4 10 0" strokeWidth="4" fill="none" strokeLinecap="round" />
    </svg>
  );
}
