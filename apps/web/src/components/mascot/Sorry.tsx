// PROVISIONAL: traced from docs/design/mascotte-sorry-provisoire.svg, a
// draft derived from idle's paths until the final drawing lands in
// docs/design/ (M2 debt, docs/jalons.md). An embarrassed "oops", never sad.
export function Sorry() {
  return (
    <svg viewBox="0 0 140 140" width="150" height="150" aria-hidden="true" focusable="false" data-testid="mascot" data-pose="sorry">
      <path d="M70 46 V26" stroke="#2B2140" strokeWidth="4" strokeLinecap="round" />
      <ellipse cx="86" cy="22" rx="15" ry="8" fill="#3FC66B" stroke="#2B2140" strokeWidth="4" transform="rotate(-18 86 22)" />
      <ellipse cx="24" cy="92" rx="12" ry="8" fill="#FFC642" stroke="#2B2140" strokeWidth="4" transform="rotate(-22 24 92)" />
      <ellipse cx="70" cy="88" rx="46" ry="42" fill="#FFC642" stroke="#2B2140" strokeWidth="4" />
      <ellipse cx="112" cy="56" rx="12" ry="8" fill="#FFC642" stroke="#2B2140" strokeWidth="4" transform="rotate(-60 112 56)" />
      <path d="M49 81 q7 -7 14 0" stroke="#2B2140" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M77 81 q7 -7 14 0" stroke="#2B2140" strokeWidth="4" fill="none" strokeLinecap="round" />
      <ellipse cx="42" cy="96" rx="7" ry="4.5" fill="#FF5D8F" opacity="0.75" />
      <ellipse cx="98" cy="96" rx="7" ry="4.5" fill="#FF5D8F" opacity="0.75" />
      <path d="M60 101 q5 -4 10 0 q5 4 10 0" stroke="#2B2140" strokeWidth="4" fill="none" strokeLinecap="round" />
    </svg>
  );
}
