export const text = "font-text text-corps text-ink-soft";
export const prompt = "font-text text-corps-l text-ink";
export const primary =
  "h-14 w-full rounded-bouton border-3 border-ink bg-mandarine px-6 font-display text-corps-l font-bold text-ink shadow-primaire disabled:opacity-60";
export const secondary =
  "h-14 w-full rounded-bouton border-3 border-ink bg-turquoise px-6 font-display text-corps-l font-bold text-ink shadow-moyenne";
export const quiet = "h-11 px-4 font-text text-corps text-ink-soft underline";
// A tappable choice; the chosen one takes the sun colour (one accent per screen).
export const choice = (chosen: boolean) =>
  `min-h-14 w-full rounded-bouton border-3 border-ink px-4 py-2 text-left font-text text-corps-l text-ink ${chosen ? "bg-soleil" : "bg-white"}`;
