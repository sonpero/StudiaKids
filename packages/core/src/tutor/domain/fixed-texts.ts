import { present } from "../../mascot/index.js";

// ⚠️ À VALIDER PAR UN ADULTE, IDÉALEMENT UN PROFESSIONNEL (docs/securite.md,
// "distress"). A proposal written at M6's opening: no advice, no promise,
// no question put to the child, the two public numbers. M6 cannot be
// closed until it is validated.
export const DISTRESS_TEXT = [
  "Ce que tu écris est important.",
  "Parles-en à un adulte en qui tu as confiance : quelqu'un de ta famille, ta maîtresse ou ton maître, l'infirmière de l'école.",
  "Tu peux aussi appeler, c'est gratuit :",
  "le 119, à toute heure, si tu es en danger ou si quelqu'un te fait du mal ;",
  "le 3018, si on te harcèle ou si on se moque de toi, à l'école ou sur internet.",
].join("\n");

// The issues whose text is fixed (docs/modules/tutor.md, `FixedIssue`).
export type FixedIssue = "off_topic" | "sensitive" | "distress" | "unavailable" | "daily_limit";

// Every text the tutor shows without a model: fixed, never generated. The
// mascot's catalogue is their single source, distress aside (not a mascot
// line: it is shown out of the conversation).
export function fixedText(issue: FixedIssue): string {
  switch (issue) {
    case "distress":
      return DISTRESS_TEXT;
    case "off_topic":
    case "sensitive":
      return present({ type: "tutor-refusal", reason: issue }, 0).line;
    case "unavailable":
      return present({ type: "tutor-unavailable" }, 0).line;
    case "daily_limit":
      return present({ type: "tutor-daily-limit" }, 0).line;
  }
}
