import { describe, expect, it } from "vitest";
import { fakeAccountRepository, fakePasswordHasher } from "./fakes.js";
import { resetPassword } from "./reset-password.js";

const now = new Date("2026-01-01T00:00:00Z");

describe("resetPassword", () => {
  it("replaces the password hash and increments sessionVersion, invalidating existing sessions", async () => {
    const accountRepository = fakeAccountRepository([
      { id: "u1", username: "alex", passwordHash: "hashed:old", firstName: "Alex", grade: "CP", sessionVersion: 1, createdAt: now.toISOString() },
    ]);

    const result = await resetPassword({ accountRepository, passwordHasher: fakePasswordHasher() }, "alex", "newpass", now);

    expect(result).toEqual({ ok: true, value: undefined });
    expect(accountRepository.rows[0]).toMatchObject({ passwordHash: "hashed:newpass", sessionVersion: 2 });
  });

  it("fails when the account does not exist", async () => {
    const accountRepository = fakeAccountRepository();

    const result = await resetPassword({ accountRepository, passwordHasher: fakePasswordHasher() }, "ghost", "newpass", now);

    expect(result).toEqual({ ok: false, error: { kind: "unknown-account" } });
  });
});
