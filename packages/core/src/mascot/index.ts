// Pure module, no application/ or infra/ (docs/modules/mascot.md). Also
// imported directly by apps/web, so it must stay free of any Node-only
// dependency.
export {
  present,
  MASCOT_POSES,
  DEFAULT_PRESENTATION,
  type MascotPose,
  type Signal,
  type Presentation,
} from "./domain/present.js";
