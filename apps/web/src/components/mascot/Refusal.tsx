import { sizeProps, type PoseProps } from "./size.js";
// M6, provisional (docs/modules/mascot.md, "Pose refusal"): derived from
// idle's traces — one hand raised, palm out, a straight calm mouth. A kind
// « not that one », never cross; its final drawing is still to come in
// docs/design/.
export function Refusal({ motion, size }: PoseProps) {
  return (
    <svg viewBox="0 0 140 140" {...sizeProps(size)} aria-hidden="true" focusable="false" data-testid="mascot" data-pose="refusal" data-motion={motion}>
      <path className="stroke-ink" d="M70 46 V26" strokeWidth="4" strokeLinecap="round" />
      <ellipse className="fill-succes stroke-ink" cx="86" cy="22" rx="15" ry="8" strokeWidth="4" transform="rotate(-18 86 22)" />
      <ellipse className="fill-soleil stroke-ink" cx="24" cy="92" rx="12" ry="8" strokeWidth="4" transform="rotate(-22 24 92)" />
      <ellipse className="fill-soleil stroke-ink" cx="120" cy="64" rx="12" ry="8" strokeWidth="4" transform="rotate(-70 120 64)" />
      <ellipse className="fill-soleil stroke-ink" cx="70" cy="88" rx="46" ry="42" strokeWidth="4" />
      <circle className="fill-ink" cx="56" cy="80" r="7" />
      <circle className="fill-ink" cx="84" cy="80" r="7" />
      <circle className="fill-canvas" cx="58.6" cy="77.4" r="2.4" />
      <circle className="fill-canvas" cx="86.6" cy="77.4" r="2.4" />
      <ellipse className="fill-joue" cx="42" cy="96" rx="7" ry="4.5" opacity="0.55" />
      <ellipse className="fill-joue" cx="98" cy="96" rx="7" ry="4.5" opacity="0.55" />
      <path className="stroke-ink" d="M61 100 h18" strokeWidth="4" fill="none" strokeLinecap="round" />
    </svg>
  );
}
