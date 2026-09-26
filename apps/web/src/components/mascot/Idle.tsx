// Traced literally from docs/design/mascotte-etats.html's `idle` pose
// (docs/ui.md, "La mascotte" — "Les tracés... ne doivent pas être
// redessinés"). Animation (léger scale vertical, 3s, en boucle) is not
// wired yet: M0 only needs a static placeholder to prove web and API are
// connected on the same origin.
export function Idle({ motion }: { motion?: "dance" }) {
  return (
    <svg viewBox="0 0 140 140" width="150" height="150" aria-hidden="true" focusable="false" data-testid="mascot" data-pose="idle" data-motion={motion}>
      <path d="M70 46 V26" stroke="#2B2140" strokeWidth="4" strokeLinecap="round" />
      <ellipse cx="86" cy="22" rx="15" ry="8" fill="#3FC66B" stroke="#2B2140" strokeWidth="4" transform="rotate(-18 86 22)" />
      <ellipse cx="24" cy="92" rx="12" ry="8" fill="#FFC642" stroke="#2B2140" strokeWidth="4" transform="rotate(-22 24 92)" />
      <ellipse cx="116" cy="92" rx="12" ry="8" fill="#FFC642" stroke="#2B2140" strokeWidth="4" transform="rotate(22 116 92)" />
      <ellipse cx="70" cy="88" rx="46" ry="42" fill="#FFC642" stroke="#2B2140" strokeWidth="4" />
      <circle cx="56" cy="80" r="7" fill="#2B2140" />
      <circle cx="84" cy="80" r="7" fill="#2B2140" />
      <circle cx="58.6" cy="77.4" r="2.4" fill="#FFF6E9" />
      <circle cx="86.6" cy="77.4" r="2.4" fill="#FFF6E9" />
      <ellipse cx="42" cy="96" rx="7" ry="4.5" fill="#FF5D8F" opacity="0.55" />
      <ellipse cx="98" cy="96" rx="7" ry="4.5" fill="#FF5D8F" opacity="0.55" />
      <path d="M60 98 q10 9 20 0" stroke="#2B2140" strokeWidth="4" fill="none" strokeLinecap="round" />
    </svg>
  );
}
