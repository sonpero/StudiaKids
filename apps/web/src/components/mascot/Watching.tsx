// Traced literally from docs/design/mascotte-etats.html's `watching` pose
// (docs/ui.md, "La mascotte": the paths are never redrawn).
export function Watching() {
  return (
    <svg viewBox="0 0 140 140" width="150" height="150" aria-hidden="true" focusable="false" data-testid="mascot" data-pose="watching">
      <g transform="rotate(-5 70 90)">
        <path d="M70 46 V26" stroke="#2B2140" strokeWidth="4" strokeLinecap="round" />
        <ellipse cx="86" cy="22" rx="15" ry="8" fill="#3FC66B" stroke="#2B2140" strokeWidth="4" transform="rotate(-18 86 22)" />
        <ellipse cx="24" cy="92" rx="12" ry="8" fill="#FFC642" stroke="#2B2140" strokeWidth="4" transform="rotate(-22 24 92)" />
        <ellipse cx="112" cy="70" rx="12" ry="8" fill="#FFC642" stroke="#2B2140" strokeWidth="4" transform="rotate(-42 112 70)" />
        <ellipse cx="70" cy="88" rx="46" ry="42" fill="#FFC642" stroke="#2B2140" strokeWidth="4" />
        <circle cx="56" cy="80" r="9" fill="#2B2140" />
        <circle cx="84" cy="80" r="9" fill="#2B2140" />
        <circle cx="59.4" cy="76.6" r="3" fill="#FFF6E9" />
        <circle cx="87.4" cy="76.6" r="3" fill="#FFF6E9" />
        <ellipse cx="42" cy="98" rx="7" ry="4.5" fill="#FF5D8F" opacity="0.55" />
        <ellipse cx="98" cy="98" rx="7" ry="4.5" fill="#FF5D8F" opacity="0.55" />
        <circle cx="70" cy="101" r="5" fill="none" stroke="#2B2140" strokeWidth="4" />
      </g>
    </svg>
  );
}
