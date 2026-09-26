// Traced literally from docs/design/mascotte-etats.html's `waiting` pose
// (docs/ui.md, "La mascotte": the paths are never redrawn).
export function Waiting({ motion }: { motion?: "dance" }) {
  return (
    <svg viewBox="0 0 140 140" width="150" height="150" aria-hidden="true" focusable="false" data-testid="mascot" data-pose="waiting" data-motion={motion}>
      <path d="M70 46 V26" stroke="#2B2140" strokeWidth="4" strokeLinecap="round" />
      <ellipse cx="86" cy="22" rx="15" ry="8" fill="#3FC66B" stroke="#2B2140" strokeWidth="4" transform="rotate(-18 86 22)" />
      <ellipse cx="24" cy="92" rx="12" ry="8" fill="#FFC642" stroke="#2B2140" strokeWidth="4" transform="rotate(-22 24 92)" />
      <ellipse cx="116" cy="92" rx="12" ry="8" fill="#FFC642" stroke="#2B2140" strokeWidth="4" transform="rotate(22 116 92)" />
      <ellipse cx="70" cy="88" rx="46" ry="42" fill="#FFC642" stroke="#2B2140" strokeWidth="4" />
      <path d="M48 78 q8 -8 16 0" stroke="#2B2140" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M76 78 q8 -8 16 0" stroke="#2B2140" strokeWidth="4" fill="none" strokeLinecap="round" />
      <ellipse cx="42" cy="96" rx="7" ry="4.5" fill="#FF5D8F" opacity="0.55" />
      <ellipse cx="98" cy="96" rx="7" ry="4.5" fill="#FF5D8F" opacity="0.55" />
      <path d="M60 96 q10 9 20 0" stroke="#2B2140" strokeWidth="4" fill="none" strokeLinecap="round" />
    </svg>
  );
}
