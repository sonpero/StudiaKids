import type { Account, Grade, SessionPayload } from "./types.js";

export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  verify(hash: string, plain: string): Promise<boolean>;
}

export interface SessionCodec {
  sign(payload: SessionPayload, now: Date): string;
  read(token: string, now: Date): SessionPayload | null;
}

export interface AccountRepository {
  findByUsername(username: string): Promise<(Account & { passwordHash: string; sessionVersion: number }) | null>;
  findById(id: string): Promise<(Account & { sessionVersion: number }) | null>;
  // `id` is generated in application/ (CLAUDE.md: IDs generated in the
  // application layer, never by the database nor decided by infra/) and
  // always provided here. Never overwrites an existing row; the caller
  // (createAccount) is responsible for checking the username is free first.
  insertAccount(id: string, username: string, hash: string, firstName: string, grade: Grade, now: Date): Promise<void>;
  // Increments sessionVersion, invalidating every existing session for the account.
  updatePasswordHash(username: string, hash: string, now: Date): Promise<void>;
  deleteAccount(id: string): Promise<void>;
}

// Not in docs/modules/auth.md's Ports list, but required to keep the rate
// limiting described in its Domain section (a pure function over an attempt
// log) testable without reaching into infra from application/.
export interface LoginAttemptRepository {
  getAttempts(ip: string): Date[];
  recordFailure(ip: string, now: Date): void;
  clear(ip: string): void;
}
