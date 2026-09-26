// docs/modules/game-engine.md: the closed list of seven game types. Same
// values as GAME_TYPES in packages/contracts (packages/core does not depend
// on it); a test in apps/api keeps both lists equal.
export const GAME_TYPES = ["delayed_copy", "mcq", "matching", "reordering", "cloze", "true_false", "mental_math"] as const;
export type GameType = (typeof GAME_TYPES)[number];

export function isGameType(value: unknown): value is GameType {
  return typeof value === "string" && (GAME_TYPES as readonly string[]).includes(value);
}
