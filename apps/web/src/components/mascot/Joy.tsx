// Traced literally from docs/design/mascotte-etats.html's `joy` pose
// (docs/ui.md, "La mascotte": the paths are never redrawn).
export function Joy() {
  return (
    <svg viewBox="0 0 160 160" width="150" height="150" aria-hidden="true" focusable="false" data-testid="mascot" data-pose="joy">
      <path d="M14 116 q6 -16 2 -30" stroke="#21C1B4" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M146 116 q-6 -16 -2 -30" stroke="#21C1B4" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M80 44 V22" stroke="#2B2140" strokeWidth="4" strokeLinecap="round" />
      <ellipse cx="96" cy="18" rx="15" ry="8" fill="#3FC66B" stroke="#2B2140" strokeWidth="4" transform="rotate(-18 96 18)" />
      <ellipse cx="30" cy="56" rx="12" ry="8" fill="#FFC642" stroke="#2B2140" strokeWidth="4" transform="rotate(-58 30 56)" />
      <ellipse cx="130" cy="56" rx="12" ry="8" fill="#FFC642" stroke="#2B2140" strokeWidth="4" transform="rotate(58 130 56)" />
      <ellipse cx="80" cy="88" rx="46" ry="42" fill="#FFC642" stroke="#2B2140" strokeWidth="4" />
      <path d="M58 78 q8 -9 16 0" stroke="#2B2140" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M86 78 q8 -9 16 0" stroke="#2B2140" strokeWidth="4" fill="none" strokeLinecap="round" />
      <ellipse cx="52" cy="96" rx="7.5" ry="5" fill="#FF5D8F" opacity="0.6" />
      <ellipse cx="108" cy="96" rx="7.5" ry="5" fill="#FF5D8F" opacity="0.6" />
      <path d="M68 92 a12 12 0 0 0 24 0 z" fill="#2B2140" />
      <ellipse cx="56" cy="128" rx="13" ry="7" fill="#FFC642" stroke="#2B2140" strokeWidth="4" />
      <ellipse cx="104" cy="128" rx="13" ry="7" fill="#FFC642" stroke="#2B2140" strokeWidth="4" />
      <path d="M22 142 h116" stroke="#2B2140" strokeWidth="4" strokeLinecap="round" strokeDasharray="3 12" opacity="0.4" />
    </svg>
  );
}
