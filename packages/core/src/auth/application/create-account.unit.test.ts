import { describe, expect, it } from "vitest";
import { fakeAccountRepository, fakeIdGenerator, fakePasswordHasher } from "./fakes.js";
import { createAccount } from "./create-account.js";

const now = new Date("2026-01-01T00:00:00Z");

describe("createAccount", () => {
  it("creates a new account with a fresh application-generated id", async () => {
    const accountRepository = fakeAccountRepository();
    const idGenerator = fakeIdGenerator(["new-id"]);

    const result = await createAccount(
      { accountRepository, passwordHasher: fakePasswordHasher(), idGenerator },
      "alex",
      "s3cret",
      "Alex",
      "CP",
      now,
    );

    expect(result).toEqual({ ok: true, value: { id: "new-id" } });
    expect(accountRepository.rows).toEqual([
      { id: "new-id", username: "alex", passwordHash: "hashed:s3cret", firstName: "Alex", grade: "CP", sessionVersion: 1, createdAt: now.toISOString() },
    ]);
  });

  it("fails without writing anything when the username is already taken", async () => {
    const accountRepository = fakeAccountRepository([
      { id: "existing", username: "alex", passwordHash: "x", firstName: "Alex", grade: "CP", sessionVersion: 1, createdAt: now.toISOString() },
    ]);
    const idGenerator = fakeIdGenerator(["new-id"]);

    const result = await createAccount(
      { accountRepository, passwordHasher: fakePasswordHasher(), idGenerator },
      "alex",
      "s3cret",
      "Alex",
      "CP",
      now,
    );

    expect(result).toEqual({ ok: false, error: { kind: "username-taken" } });
    expect(accountRepository.rows).toHaveLength(1);
    expect(accountRepository.rows[0]?.id).toBe("existing");
  });
});
