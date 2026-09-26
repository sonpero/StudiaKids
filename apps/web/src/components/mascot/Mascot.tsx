import { Glitch } from "./Glitch.js";
import { Idle } from "./Idle.js";
import { Joy } from "./Joy.js";
import { Sorry } from "./Sorry.js";
import { Waiting } from "./Waiting.js";

// docs/ui.md, "Contrat d'API du composant". The full closed list of seven
// poses; `watching` and `refusal` get their component when a screen
// needs them (docs/modules/mascot.md).
export type MascotPose = "idle" | "watching" | "waiting" | "joy" | "sorry" | "glitch" | "refusal";

export interface MascotProps {
  pose: MascotPose;
  size?: "sm" | "md" | "lg" | "avatar";
}

// Robustness rule (docs/ui.md): an unrecognized or not-yet-drawn pose
// renders `idle`, never an exception or an empty element.
export function Mascot({ pose }: MascotProps) {
  switch (pose) {
    case "waiting":
      return <Waiting />;
    case "sorry":
      return <Sorry />;
    case "glitch":
      return <Glitch />;
    case "joy":
      return <Joy />;
    default:
      return <Idle />;
  }
}
