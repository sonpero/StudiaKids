// PROVISIONAL: traced from docs/design/mascotte-glitch-provisoire.svg, a
// draft derived from idle's paths until the final drawing lands in
// docs/design/ (M2 debt, docs/jalons.md). A harmless breakdown, no drama.
export function Glitch() {
  return (
    <svg viewBox="0 0 140 140" width="150" height="150" aria-hidden="true" focusable="false" data-testid="mascot" data-pose="glitch">
      <path d="M70 46 V36 L80 28" stroke="#2B2140" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <ellipse cx="88" cy="34" rx="15" ry="8" fill="#3FC66B" stroke="#2B2140" strokeWidth="4" transform="rotate(38 88 34)" />
      <path d="M104 14 l-6 8 h7 l-6 9" stroke="#2B2140" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <ellipse cx="24" cy="92" rx="12" ry="8" fill="#FFC642" stroke="#2B2140" strokeWidth="4" transform="rotate(-22 24 92)" />
      <ellipse cx="116" cy="92" rx="12" ry="8" fill="#FFC642" stroke="#2B2140" strokeWidth="4" transform="rotate(22 116 92)" />
      <ellipse cx="70" cy="88" rx="46" ry="42" fill="#FFC642" stroke="#2B2140" strokeWidth="4" />
      <circle cx="56" cy="80" r="7" fill="#2B2140" />
      <circle cx="58.6" cy="77.4" r="2.4" fill="#FFF6E9" />
      <circle cx="85" cy="76" r="4.5" fill="#2B2140" />
      <circle cx="86.6" cy="74.4" r="1.6" fill="#FFF6E9" />
      <ellipse cx="42" cy="96" rx="7" ry="4.5" fill="#FF5D8F" opacity="0.55" />
      <ellipse cx="98" cy="96" rx="7" ry="4.5" fill="#FF5D8F" opacity="0.55" />
      <path d="M62 101 L78 99" stroke="#2B2140" strokeWidth="4" fill="none" strokeLinecap="round" />
    </svg>
  );
}
