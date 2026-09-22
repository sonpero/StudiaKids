import {
  Argon2PasswordHasher,
  HmacSessionCodec,
  InMemoryLoginAttemptRepository,
  SqliteAccountRepository,
  uuidV7Generator,
  type AuthenticateDeps,
  type CreateAccountDeps,
  type DeleteAccountDeps,
  type ResetPasswordDeps,
} from "@studiakids/core";
import type { Db } from "./db/connection.js";

// A fixed, valid argon2id hash verified on every login for an unknown
// username, so an unknown-user response takes the same code path (and
// comparable time) as a wrong-password response (docs/modules/auth.md:
// "la vérification doit être à temps constant dans le cas d'un identifiant
// inconnu"). Not tied to any real account; the plaintext behind it is never
// used to log in.
const DUMMY_PASSWORD_HASH = "$argon2id$v=19$m=65536,t=3,p=4$QLXQS4gSUj9JgJOHh2YNvA$EtxxKIkTTnKBzsZSo7AvR7lnx3Mj2v0iCvW5kURQHjI";

export interface AuthDeps {
  authenticateDeps: AuthenticateDeps;
  createAccountDeps: CreateAccountDeps;
  resetPasswordDeps: ResetPasswordDeps;
  deleteAccountDeps: DeleteAccountDeps;
  sessionCodec: HmacSessionCodec;
  accountRepository: SqliteAccountRepository;
}

export function buildAuthDeps(db: Db, sessionSecret: string, sessionDurationDays: number): AuthDeps {
  const accountRepository = new SqliteAccountRepository(db);
  const passwordHasher = new Argon2PasswordHasher();
  const sessionCodec = new HmacSessionCodec(sessionSecret, sessionDurationDays * 24 * 60 * 60 * 1000);
  const attemptRepository = new InMemoryLoginAttemptRepository();

  return {
    authenticateDeps: {
      accountRepository,
      passwordHasher,
      sessionCodec,
      attemptRepository,
      dummyPasswordHash: DUMMY_PASSWORD_HASH,
    },
    createAccountDeps: { accountRepository, passwordHasher, idGenerator: uuidV7Generator },
    resetPasswordDeps: { accountRepository, passwordHasher },
    deleteAccountDeps: { accountRepository },
    sessionCodec,
    accountRepository,
  };
}
