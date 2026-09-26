import type { AccountRepository } from "../domain/ports.js";

export interface DeleteAccountDeps {
  accountRepository: AccountRepository;
}

// CLI only, never reachable over HTTP (docs/modules/auth.md). Only deletes
// the accounts row: other modules' rows follow by ON DELETE CASCADE, and
// their files are removed by the CLI, which composes auth with them
// (apps/api/src/account-deletion.ts) — auth never depends on another module.
export async function deleteAccount(deps: DeleteAccountDeps, userId: string): Promise<void> {
  await deps.accountRepository.deleteAccount(userId);
}
