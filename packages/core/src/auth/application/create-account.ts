import { err, ok, type Result } from "../../shared/index.js";
import type { IdGenerator } from "../../shared/index.js";
import type { AccountRepository, PasswordHasher } from "../domain/ports.js";
import type { CreateAccountError, Grade } from "../domain/types.js";

export interface CreateAccountDeps {
  accountRepository: AccountRepository;
  passwordHasher: PasswordHasher;
  idGenerator: IdGenerator;
}

// CLI only, never reachable over HTTP (docs/modules/auth.md).
export async function createAccount(
  deps: CreateAccountDeps,
  username: string,
  password: string,
  firstName: string,
  grade: Grade,
  now: Date,
): Promise<Result<{ id: string }, CreateAccountError>> {
  const existing = await deps.accountRepository.findByUsername(username);
  if (existing) return err({ kind: "username-taken" });

  const hash = await deps.passwordHasher.hash(password);
  const id = deps.idGenerator.next();
  await deps.accountRepository.insertAccount(id, username, hash, firstName, grade, now);
  return ok({ id });
}
