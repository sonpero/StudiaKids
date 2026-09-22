export type { Account, Grade, SessionPayload, LoginError, CreateAccountError, ResetPasswordError } from "./domain/types.js";
export type { PasswordHasher, SessionCodec, AccountRepository, LoginAttemptRepository } from "./domain/ports.js";

export { authenticate, type AuthenticateDeps } from "./application/authenticate.js";
export { resolveSession, type ResolveSessionDeps } from "./application/resolve-session.js";
export { createAccount, type CreateAccountDeps } from "./application/create-account.js";
export { resetPassword, type ResetPasswordDeps } from "./application/reset-password.js";
export { deleteAccount, type DeleteAccountDeps } from "./application/delete-account.js";

export { Argon2PasswordHasher } from "./infra/argon2-password-hasher.js";
export { HmacSessionCodec, DEFAULT_SESSION_DURATION_DAYS } from "./infra/hmac-session-codec.js";
export { InMemoryLoginAttemptRepository } from "./infra/in-memory-login-attempt-repository.js";
export { SqliteAccountRepository, type AuthDb } from "./infra/account-repository.js";
// Exported so apps/api/src/db/schema.ts (if any) can aggregate it for
// drizzle-kit (drizzle-kit needs a single entry file); not part of the
// module's use-case surface. In practice drizzle.config.ts globs
// infra/schema.ts directly (see its comment), so nothing imports this today.
export { accountsTable } from "./infra/schema.js";
