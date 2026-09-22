import { describe, expect, it } from "vitest";
import { fakeAccountRepository } from "./fakes.js";
import { deleteAccount } from "./delete-account.js";

const now = new Date("2026-01-01T00:00:00Z");

describe("deleteAccount", () => {
  it("removes the account row", async () => {
    const accountRepository = fakeAccountRepository([
      { id: "u1", username: "alex", passwordHash: "x", firstName: "Alex", grade: "CP", sessionVersion: 1, createdAt: now.toISOString() },
    ]);

    await deleteAccount({ accountRepository }, "u1");

    expect(accountRepository.rows).toEqual([]);
  });
});
