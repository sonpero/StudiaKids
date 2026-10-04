// The shared look of every screen, drawn from docs/design/*.png and
// docs/design/tokens.md ("Formes"): ink outlines, card radius, hard ink
// shadows, Baloo for actions and titles, Lexend for text.
const action = "flex h-14 w-full items-center justify-center gap-2 rounded-carte border-3 px-6 font-display text-corps-l font-bold text-ink disabled:opacity-60";

export const button = {
  primary: `${action} border-ink bg-mandarine shadow-primaire`,
  secondary: `${action} border-ink bg-turquoise shadow-moyenne`,
  // A second way out, quieter than an action (docs/design/saisie.png).
  dashed: `${action} border-dashed border-ink-soft bg-transparent`,
  quiet: "min-h-11 px-4 font-text text-corps text-ink-soft underline",
};

export const iconButton = "flex h-11 w-11 shrink-0 items-center justify-center rounded-bouton border-3 border-ink bg-white text-ink shadow-petite";

// Any text the child must read in full, whatever its length: it wraps
// inside a word when it has to (anywhere, so a flex or centred parent never
// sizes to the word), hyphenated in French (lang="fr" on <html>), never
// smaller and never cut. Its box grows with it (no fixed height).
export const readable = "min-w-0 wrap-anywhere hyphens-auto";

export const card = `${readable} rounded-carte border-3 border-ink bg-white shadow-moyenne`;

export const field = "h-14 w-full rounded-carte border-3 border-ink bg-white px-4 font-text text-corps-l text-ink placeholder:text-ink-soft focus:border-mandarine focus:outline-none";

export const bubble = `${readable} rounded-carte border-3 border-ink px-4 py-3 font-text text-corps text-ink`;

export const title = "font-display text-titre font-bold text-ink";
export const text = `${readable} font-text text-corps text-ink-soft`;

// A tappable answer; the chosen one takes the active peach (tokens.md: the
// sun is for stars and the mascot).
export const choice = (chosen: boolean) =>
  `${readable} min-h-14 w-full rounded-carte border-3 border-ink px-4 py-2 text-left font-text text-corps-l text-ink shadow-petite ${chosen ? "bg-peche" : "bg-white"}`;
