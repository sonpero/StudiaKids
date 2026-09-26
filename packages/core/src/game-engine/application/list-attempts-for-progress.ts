import type { AttemptRecord } from "../domain/play.js";
import type { AttemptRepository } from "../domain/ports.js";

// For progress (docs/modules/progress.md): every attempt of the account,
// through this module's index, never its table.
export function listAttemptsForProgress(deps: { attempts: AttemptRepository }, userId: string): Promise<AttemptRecord[]> {
  return deps.attempts.listByUser(userId);
}
