import { sizeProps, type PoseProps } from "./size.js";
// M6, provisional (docs/modules/mascot.md, "Pose refusal"): derived from
// idle's traces — one hand raised, palm out, a straight calm mouth. A kind
// « not that one », never cross; its final drawing is still to come in
// docs/design/.
export function Refusal({ motion, size }: PoseProps) {
  return (
    <svg viewBox="0 0 140 140" {...sizeProps(size)} aria-hidden="true" focusable="false" data-testid="mascot" data-pose="refusal" data-motion={motion}>
      <path d="M70 46 V26" stroke="#2B2140" strokeWidth="4" strokeLinecap="round" />
      <ellipse cx="86" cy="22" rx="15" ry="8" fill="#3FC66B" stroke="#2B2140" strokeWidth="4" transform="rotate(-18 86 22)" />
      <ellipse cx="24" cy="92" rx="12" ry="8" fill="#FFC642" stroke="#2B2140" strokeWidth="4" transform="rotate(-22 24 92)" />
      <ellipse cx="120" cy="64" rx="12" ry="8" fill="#FFC642" stroke="#2B2140" strokeWidth="4" transform="rotate(-70 120 64)" />
      <ellipse cx="70" cy="88" rx="46" ry="42" fill="#FFC642" stroke="#2B2140" strokeWidth="4" />
      <circle cx="56" cy="80" r="7" fill="#2B2140" />
      <circle cx="84" cy="80" r="7" fill="#2B2140" />
      <circle cx="58.6" cy="77.4" r="2.4" fill="#FFF6E9" />
      <circle cx="86.6" cy="77.4" r="2.4" fill="#FFF6E9" />
      <ellipse cx="42" cy="96" rx="7" ry="4.5" fill="#FF5D8F" opacity="0.55" />
      <ellipse cx="98" cy="96" rx="7" ry="4.5" fill="#FF5D8F" opacity="0.55" />
      <path d="M61 100 h18" stroke="#2B2140" strokeWidth="4" fill="none" strokeLinecap="round" />
    </svg>
  );
}
