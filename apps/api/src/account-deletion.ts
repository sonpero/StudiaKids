import { deleteAccount, LocalFileStore, SqliteAccountRepository } from "@studiakids/core";
import type { Db } from "./db/connection.js";

export interface AccountDeletionDeps {
  db: Db;
  volumeRoot: string;
}

// Composes auth and ingestion through their index.ts: auth never depends
// on ingestion (docs/modules/auth.md). Rows follow the accounts row by ON
// DELETE CASCADE; photos are files, so they are removed here. Files first:
// if it breaks midway, the account is still there and the command can be
// run again, whereas photos left behind by a deleted account would outlive
// it silently (docs/securite.md).
export async function deleteAccountWithPhotos(deps: AccountDeletionDeps, username: string): Promise<"deleted" | "not-found"> {
  const accountRepository = new SqliteAccountRepository(deps.db);
  const account = await accountRepository.findByUsername(username);
  if (!account) return "not-found";

  await new LocalFileStore(deps.volumeRoot).deleteAccountFiles(account.id);
  await deleteAccount({ accountRepository }, account.id);
  return "deleted";
}
