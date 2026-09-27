import { Mascot, type MascotPose, type MascotProps } from "../mascot/Mascot.js";
import { bubble } from "./styles.js";

// The mascot speaking, as on docs/design/accueil.png: its sentence in a
// white speech bubble pointing down at it. Every screen's states use it.
export function MascotSays({ pose, line, role, size, motion }: { pose: MascotPose; line: string; role?: "alert" | "status"; size?: MascotProps["size"]; motion?: MascotProps["motion"] }) {
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <p data-bubble role={role} className={`${bubble} relative w-full bg-white text-center shadow-petite`}>
        {line}
        <span aria-hidden="true" className="absolute -bottom-2 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-r-3 border-b-3 border-ink bg-white" />
      </p>
      <Mascot pose={pose} size={size} motion={motion} />
    </div>
  );
}
