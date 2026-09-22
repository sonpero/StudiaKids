import { err, ok, type Result } from "../../shared/index.js";
import type { AccountRepository, SessionCodec } from "../domain/ports.js";
import type { Account } from "../domain/types.js";

export interface ResolveSessionDeps {
  sessionCodec: SessionCodec;
  accountRepository: AccountRepository;
}

export async function resolveSession(
  deps: ResolveSessionDeps,
  token: string,
  now: Date,
): Promise<Result<{ account: Account; token: string }, "unauthenticated">> {
  const payload = deps.sessionCodec.read(token, now);
  if (!payload) return err("unauthenticated");

  const record = await deps.accountRepository.findById(payload.userId);
  if (!record) return err("unauthenticated");
  if (record.sessionVersion !== payload.sessionVersion) return err("unauthenticated");

  // Sliding session (docs/modules/auth.md): every successful resolve re-signs
  // a fresh token, pushing expiry out again — a session reused regularly
  // never presents as expired.
  const reissuedToken = deps.sessionCodec.sign({ userId: record.id, sessionVersion: record.sessionVersion }, now);
  const account: Account = { id: record.id, username: record.username, firstName: record.firstName, grade: record.grade, createdAt: record.createdAt };

  return ok({ account, token: reissuedToken });
}
