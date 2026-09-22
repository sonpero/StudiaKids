import { err, ok, type Result } from "../../shared/index.js";
import type { AccountRepository, PasswordHasher } from "../domain/ports.js";
import type { ResetPasswordError } from "../domain/types.js";

export interface ResetPasswordDeps {
  accountRepository: AccountRepository;
  passwordHasher: PasswordHasher;
}

// CLI only, never reachable over HTTP (docs/modules/auth.md).
export async function resetPassword(
  deps: ResetPasswordDeps,
  username: string,
  password: string,
  now: Date,
): Promise<Result<void, ResetPasswordError>> {
  const existing = await deps.accountRepository.findByUsername(username);
  if (!existing) return err({ kind: "unknown-account" });

  const hash = await deps.passwordHasher.hash(password);
  await deps.accountRepository.updatePasswordHash(username, hash, now);
  return ok(undefined);
}
