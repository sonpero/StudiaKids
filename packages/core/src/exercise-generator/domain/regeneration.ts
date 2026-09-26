// A type is regenerated once when fewer than half the exercises asked are
// valid, or none is (docs/modules/exercise-generator.md).
export function needsRegeneration(asked: number, valid: number): boolean {
  if (asked === 0) return false;
  return valid === 0 || valid * 2 < asked;
}
