import { Idle } from "./Idle.js";

// docs/ui.md, "Contrat d'API du composant". The full closed list of seven
// poses, even though only `idle` has art yet (`watching`/`waiting`/`joy`
// are drawn in docs/design/mascotte-etats.html but have no component file
// yet either — added when the screens that need them land, `sorry`/
// `glitch`/`refusal` before M2/M2/M6 respectively per docs/modules/mascot.md).
export type MascotPose = "idle" | "watching" | "waiting" | "joy" | "sorry" | "glitch" | "refusal";

export interface MascotProps {
  pose: MascotPose;
  size?: "sm" | "md" | "lg" | "avatar";
}

// Robustness rule (docs/ui.md): an unrecognized or not-yet-drawn pose
// renders `idle`, never an exception or an empty element.
export function Mascot({ pose }: MascotProps) {
  switch (pose) {
    case "idle":
      return <Idle />;
    default:
      return <Idle />;
  }
}
