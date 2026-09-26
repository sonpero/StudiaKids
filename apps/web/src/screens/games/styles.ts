export const text = "font-[family-name:var(--font-text)] text-[16px] text-[var(--color-ink-soft)]";
export const prompt = "font-[family-name:var(--font-text)] text-[18px] text-[var(--color-ink)]";
export const primary =
  "h-[56px] w-full rounded-[15px] border-[3px] border-[var(--color-ink)] bg-[var(--color-mandarine)] px-6 font-[family-name:var(--font-display)] text-[18px] font-bold text-[var(--color-ink)] shadow-[0_5px_0_var(--color-ink)] disabled:opacity-60";
export const secondary =
  "h-[56px] w-full rounded-[15px] border-[3px] border-[var(--color-ink)] bg-[var(--color-turquoise)] px-6 font-[family-name:var(--font-display)] text-[18px] font-bold text-[var(--color-ink)] shadow-[0_4px_0_var(--color-ink)]";
export const quiet = "h-[44px] px-4 font-[family-name:var(--font-text)] text-[16px] text-[var(--color-ink-soft)] underline";
// A tappable choice; the chosen one takes the sun colour (one accent per screen).
export const choice = (chosen: boolean) =>
  `min-h-[56px] w-full rounded-[15px] border-[3px] border-[var(--color-ink)] px-4 py-2 text-left font-[family-name:var(--font-text)] text-[18px] text-[var(--color-ink)] ${chosen ? "bg-[var(--color-soleil)]" : "bg-white"}`;
