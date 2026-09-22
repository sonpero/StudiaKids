import type { AccountRepository } from "../domain/ports.js";

export interface DeleteAccountDeps {
  accountRepository: AccountRepository;
}

// CLI only, never reachable over HTTP (docs/modules/auth.md). Only deletes
// the accounts row: at M1 no other table references userId yet, so there is
// nothing to cascade. Modules added later own wiring their own cascade
// (docs/modules/auth.md, docs/securite.md "Suppression et droit à l'oubli").
export async function deleteAccount(deps: DeleteAccountDeps, userId: string): Promise<void> {
  await deps.accountRepository.deleteAccount(userId);
}
