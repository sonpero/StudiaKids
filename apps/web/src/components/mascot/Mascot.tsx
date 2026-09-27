import { Glitch } from "./Glitch.js";
import { Idle } from "./Idle.js";
import { Joy } from "./Joy.js";
import { Refusal } from "./Refusal.js";
import { Sorry } from "./Sorry.js";
import { Waiting } from "./Waiting.js";
import { Watching } from "./Watching.js";
import type { MascotSize } from "./size.js";

// docs/ui.md, "Contrat d'API du composant". The full closed list of seven
// poses (refusal drawn provisionally at M6, docs/modules/mascot.md).
export type MascotPose = "idle" | "watching" | "waiting" | "joy" | "sorry" | "glitch" | "refusal";

export interface MascotProps {
  pose: MascotPose;
  // The joy dance, asked for by the screen (streak bonus, comeback): an
  // animation of styles/motion.css, still under prefers-reduced-motion.
  motion?: "dance";
  size?: MascotSize;
}

// Robustness rule (docs/ui.md): an unrecognized or not-yet-drawn pose
// renders `idle`, never an exception or an empty element.
export function Mascot({ pose, motion, size }: MascotProps) {
  switch (pose) {
    case "waiting":
      return <Waiting motion={motion} size={size} />;
    case "sorry":
      return <Sorry motion={motion} size={size} />;
    case "glitch":
      return <Glitch motion={motion} size={size} />;
    case "joy":
      return <Joy motion={motion} size={size} />;
    case "refusal":
      return <Refusal motion={motion} size={size} />;
    case "watching":
      return <Watching motion={motion} size={size} />;
    default:
      return <Idle motion={motion} size={size} />;
  }
}
