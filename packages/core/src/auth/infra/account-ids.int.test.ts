import { sql } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { freshDb } from "../../../../../tests/support/db.js";
import { SqliteAccountRepository } from "./account-repository.js";

// For the background clean-ups that go account by account (abandoned
// courses, photos kept before 2026-10-04): every account's id, nothing else.
describe("SqliteAccountRepository.listAccountIds", () => {
  let cleanup: (() => void) | undefined;
  afterEach(() => cleanup?.());

  it("lists every account's id, in creation order", async () => {
    const fresh = freshDb();
    cleanup = fresh.cleanup;
    for (const [id, username, at] of [["u2", "tom", "2026-10-02T00:00:00.000Z"], ["u1", "lea", "2026-10-01T00:00:00.000Z"]]) {
      fresh.db.run(sql`INSERT INTO accounts (id, username, password_hash, session_version, first_name, grade, created_at) VALUES (${id}, ${username}, 'x', 1, 'A', 'CE2', ${at})`);
    }

    expect(await new SqliteAccountRepository(fresh.db).listAccountIds()).toEqual(["u1", "u2"]);
  });
});
