import type { AttemptEvent } from "./progress.js";

// The only port: the account's attempts, read through game-engine's index
// (wired by the API), never its table.
export interface AttemptsQuery {
  listByUser(userId: string): Promise<AttemptEvent[]>;
}
