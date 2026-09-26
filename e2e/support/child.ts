import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test as base, expect } from "@playwright/test";
import { Argon2PasswordHasher, createAccount, SqliteAccountRepository, uuidV7Generator } from "@studiakids/core";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { E2E_DATA_DIR } from "./env.js";

export const CHILD_FIRST_NAME = "Léa";
export const CHILD_GRADE = "CM1";
export const CHILD_PASSWORD = "e2e-Child-Secret!";
const PASSWORD = CHILD_PASSWORD;

// The recorded fixtures' photos: the worker's fixture adapter recognises
// each case by its size (docs/modules/ingestion.md).
export const photosDir = fileURLToPath(new URL("../../tests/fixtures/ingestion/photos", import.meta.url));
export const photo = (name: string) => path.join(photosDir, `${name}.jpg`);
export const cameraPhoto = fileURLToPath(new URL("../fixtures/camera-rotated-gps.jpg", import.meta.url));

// Accounts are CLI-only (docs/modules/auth.md): seeded straight into the
// e2e database, like global-setup.ts does. A fresh username every time,
// so a retried test never meets its previous run's courses.
async function seedChild(): Promise<string> {
  const username = `child-${randomUUID()}`;
  const sqlite = new Database(path.join(E2E_DATA_DIR, "db", "studiakids.db"));
  sqlite.pragma("busy_timeout = 5000");
  try {
    await createAccount(
      { accountRepository: new SqliteAccountRepository(drizzle(sqlite)), passwordHasher: new Argon2PasswordHasher(), idGenerator: uuidV7Generator },
      username,
      PASSWORD,
      CHILD_FIRST_NAME,
      CHILD_GRADE,
      new Date(),
    );
  } finally {
    sqlite.close();
  }
  return username;
}

// Decided at M2: one account per scenario (an account holds at most one
// unconfirmed course), logged in over HTTP before the page opens.
export const test = base.extend<{ child: { username: string } }>({
  storageState: { cookies: [], origins: [] },
  child: async ({ context }, use) => {
    const username = await seedChild();
    const res = await context.request.post("/api/auth/login", { data: { username, password: PASSWORD } });
    expect(res.status()).toBe(204);
    await use({ username });
  },
});

export { expect };
