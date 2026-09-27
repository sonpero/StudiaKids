import { sizeProps, type PoseProps } from "./size.js";
// Traced literally from docs/design/mascotte-etats.html's `joy` pose
// (docs/ui.md, "La mascotte": the paths are never redrawn).
export function Joy({ motion, size }: PoseProps) {
  return (
    <svg viewBox="0 0 160 160" {...sizeProps(size)} aria-hidden="true" focusable="false" data-testid="mascot" data-pose="joy" data-motion={motion}>
      <path className="stroke-turquoise" d="M14 116 q6 -16 2 -30" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path className="stroke-turquoise" d="M146 116 q-6 -16 -2 -30" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path className="stroke-ink" d="M80 44 V22" strokeWidth="4" strokeLinecap="round" />
      <ellipse className="fill-succes stroke-ink" cx="96" cy="18" rx="15" ry="8" strokeWidth="4" transform="rotate(-18 96 18)" />
      <ellipse className="fill-soleil stroke-ink" cx="30" cy="56" rx="12" ry="8" strokeWidth="4" transform="rotate(-58 30 56)" />
      <ellipse className="fill-soleil stroke-ink" cx="130" cy="56" rx="12" ry="8" strokeWidth="4" transform="rotate(58 130 56)" />
      <ellipse className="fill-soleil stroke-ink" cx="80" cy="88" rx="46" ry="42" strokeWidth="4" />
      <path className="stroke-ink" d="M58 78 q8 -9 16 0" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path className="stroke-ink" d="M86 78 q8 -9 16 0" strokeWidth="4" fill="none" strokeLinecap="round" />
      <ellipse className="fill-joue" cx="52" cy="96" rx="7.5" ry="5" opacity="0.6" />
      <ellipse className="fill-joue" cx="108" cy="96" rx="7.5" ry="5" opacity="0.6" />
      <path className="fill-ink" d="M68 92 a12 12 0 0 0 24 0 z" />
      <ellipse className="fill-soleil stroke-ink" cx="56" cy="128" rx="13" ry="7" strokeWidth="4" />
      <ellipse className="fill-soleil stroke-ink" cx="104" cy="128" rx="13" ry="7" strokeWidth="4" />
      <path className="stroke-ink" d="M22 142 h116" strokeWidth="4" strokeLinecap="round" strokeDasharray="3 12" opacity="0.4" />
    </svg>
  );
}
