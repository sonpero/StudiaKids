import type { AttemptRepository } from "../domain/ports.js";

// Before a confirmed course is deleted (docs/modules/game-engine.md,
// "Tentatives détachées"): its exercises' attempts outlive it, so that the
// star total never goes down, with nothing but what stars need.
export function detachAttempts(deps: { attempts: AttemptRepository }, userId: string, exerciseIds: string[]): Promise<void> {
  return deps.attempts.detach(userId, exerciseIds);
}
