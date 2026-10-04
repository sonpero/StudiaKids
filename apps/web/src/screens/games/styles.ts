import { button, choice as sharedChoice, readable, text as sharedText } from "../../components/ui/styles.js";

// The games' look, from the shared styles (components/ui/styles.ts).
export const text = sharedText;
export const prompt = `${readable} font-text text-corps-l text-ink`;
export const primary = button.primary;
export const secondary = button.secondary;
export const dashed = button.dashed;
export const quiet = button.quiet;
export const choice = sharedChoice;
