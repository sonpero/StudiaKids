import { Glitch } from "./Glitch.js";
import { Idle } from "./Idle.js";
import { Joy } from "./Joy.js";
import { Sorry } from "./Sorry.js";
import { Waiting } from "./Waiting.js";
import { Watching } from "./Watching.js";

// docs/ui.md, "Contrat d'API du composant". The full closed list of seven
// poses; `refusal` gets its component when a screen
// needs them (docs/modules/mascot.md).
export type MascotPose = "idle" | "watching" | "waiting" | "joy" | "sorry" | "glitch" | "refusal";

export interface MascotProps {
  pose: MascotPose;
  // The joy dance, asked for by the screen (streak bonus, comeback): an
  // animation of styles/motion.css, still under prefers-reduced-motion.
  motion?: "dance";
  size?: "sm" | "md" | "lg" | "avatar";
}

// Robustness rule (docs/ui.md): an unrecognized or not-yet-drawn pose
// renders `idle`, never an exception or an empty element.
export function Mascot({ pose, motion }: MascotProps) {
  switch (pose) {
    case "waiting":
      return <Waiting motion={motion} />;
    case "sorry":
      return <Sorry motion={motion} />;
    case "glitch":
      return <Glitch motion={motion} />;
    case "joy":
      return <Joy motion={motion} />;
    case "watching":
      return <Watching motion={motion} />;
    default:
      return <Idle motion={motion} />;
  }
}
