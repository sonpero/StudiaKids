import { eq, sql } from "drizzle-orm";
import type { drizzle } from "drizzle-orm/better-sqlite3";
import type { AccountRepository } from "../domain/ports.js";
import type { Grade } from "../domain/types.js";
import { accountsTable } from "./schema.js";

// Matches whatever drizzle(sqlite) actually infers at each call site (no
// schema map passed in), rather than a hand-picked generic that can drift
// out of sync with it (see apps/api/src/db/connection.ts's Db type, built
// the same way).
export type AuthDb = ReturnType<typeof drizzle>;

// better-sqlite3 is synchronous; these methods return Promise.resolve(...)
// rather than being declared `async` so the (already-resolved) value isn't
// wrapped in an extra microtask, while still satisfying the async
// AccountRepository port.
export class SqliteAccountRepository implements AccountRepository {
  constructor(private readonly db: AuthDb) {}

  findByUsername(username: string): ReturnType<AccountRepository["findByUsername"]> {
    const row = this.db.select().from(accountsTable).where(eq(accountsTable.username, username)).get();
    if (!row) return Promise.resolve(null);
    return Promise.resolve({
      id: row.id,
      username: row.username,
      firstName: row.firstName,
      grade: row.grade as Grade,
      createdAt: row.createdAt,
      passwordHash: row.passwordHash,
      sessionVersion: row.sessionVersion,
    });
  }

  findById(id: string): ReturnType<AccountRepository["findById"]> {
    const row = this.db.select().from(accountsTable).where(eq(accountsTable.id, id)).get();
    if (!row) return Promise.resolve(null);
    return Promise.resolve({
      id: row.id,
      username: row.username,
      firstName: row.firstName,
      grade: row.grade as Grade,
      createdAt: row.createdAt,
      sessionVersion: row.sessionVersion,
    });
  }

  // try/catch (unlike the other methods here) so that a synchronous throw
  // from .run() — a duplicate username hitting the UNIQUE constraint —
  // becomes a rejected promise instead of an exception thrown before this
  // method returns anything, which `Result`-returning callers couldn't catch.
  insertAccount(id: string, username: string, hash: string, firstName: string, grade: Grade, now: Date): Promise<void> {
    try {
      this.db
        .insert(accountsTable)
        .values({ id, username, passwordHash: hash, firstName, grade, sessionVersion: 1, createdAt: now.toISOString() })
        .run();
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error(String(error)));
    }
  }

  updatePasswordHash(username: string, hash: string, _now: Date): Promise<void> {
    this.db
      .update(accountsTable)
      .set({ passwordHash: hash, sessionVersion: sql`${accountsTable.sessionVersion} + 1` })
      .where(eq(accountsTable.username, username))
      .run();
    return Promise.resolve();
  }

  deleteAccount(id: string): Promise<void> {
    this.db.delete(accountsTable).where(eq(accountsTable.id, id)).run();
    return Promise.resolve();
  }
}
