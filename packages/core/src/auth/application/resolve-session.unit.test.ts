import { describe, expect, it } from "vitest";
import { HmacSessionCodec } from "../infra/hmac-session-codec.js";
import { fakeAccountRepository, fakeSessionCodec } from "./fakes.js";
import { resolveSession } from "./resolve-session.js";

const now = new Date("2026-01-01T00:00:00Z");

const account = {
  id: "u1",
  username: "alex",
  firstName: "Alex",
  grade: "CP" as const,
  createdAt: now.toISOString(),
  sessionVersion: 1,
  passwordHash: "irrelevant",
};

describe("resolveSession", () => {
  it("resolves the account and re-issues a token on a valid session", async () => {
    const sessionCodec = fakeSessionCodec();
    const accountRepository = fakeAccountRepository([account]);
    const token = sessionCodec.sign({ userId: "u1", sessionVersion: 1 }, now);

    const result = await resolveSession({ sessionCodec, accountRepository }, token, now);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.account).toEqual({ id: "u1", username: "alex", firstName: "Alex", grade: "CP", createdAt: now.toISOString() });
      expect(typeof result.value.token).toBe("string");
    }
  });

  it("rejects a token with a bad signature", async () => {
    const sessionCodec = fakeSessionCodec();
    const accountRepository = fakeAccountRepository([account]);

    const result = await resolveSession({ sessionCodec, accountRepository }, "not-a-real-token", now);

    expect(result).toEqual({ ok: false, error: "unauthenticated" });
  });

  it("rejects a token for an account that no longer exists", async () => {
    const sessionCodec = fakeSessionCodec();
    const accountRepository = fakeAccountRepository([]);
    const token = sessionCodec.sign({ userId: "ghost", sessionVersion: 1 }, now);

    const result = await resolveSession({ sessionCodec, accountRepository }, token, now);

    expect(result).toEqual({ ok: false, error: "unauthenticated" });
  });

  it("rejects a token whose sessionVersion no longer matches the stored one (revoked by a password reset)", async () => {
    const sessionCodec = fakeSessionCodec();
    const accountRepository = fakeAccountRepository([{ ...account, sessionVersion: 2 }]);
    const token = sessionCodec.sign({ userId: "u1", sessionVersion: 1 }, now);

    const result = await resolveSession({ sessionCodec, accountRepository }, token, now);

    expect(result).toEqual({ ok: false, error: "unauthenticated" });
  });

  // docs/modules/auth.md: "une session valide, réutilisée régulièrement, ne
  // présente jamais d'expiration" — a real codec is used here (not the fake,
  // which hardcodes its own expiry) because this proves the actual sliding
  // math, not just that resolveSession calls sign() again.
  const SESSION_DURATION_DAYS = 365;
  const sessionCodec = new HmacSessionCodec("test-secret", SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);

  it("never expires a session that is reused well within SESSION_DURATION_DAYS of its last use", async () => {
    const accountRepository = fakeAccountRepository([account]);
    let token = sessionCodec.sign({ userId: "u1", sessionVersion: 1 }, now);
    let current = now;

    // Step forward by 300 days at a time, well under the 365-day TTL, with an
    // authenticated call at each step — spans several years in total.
    for (let i = 0; i < 6; i++) {
      current = new Date(current.getTime() + 300 * 24 * 60 * 60 * 1000);
      const result = await resolveSession({ sessionCodec, accountRepository }, token, current);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("unreachable");
      token = result.value.token;
    }
  });

  it("expires a session left unused for longer than SESSION_DURATION_DAYS", async () => {
    const accountRepository = fakeAccountRepository([account]);
    const token = sessionCodec.sign({ userId: "u1", sessionVersion: 1 }, now);
    const muchLater = new Date(now.getTime() + (SESSION_DURATION_DAYS + 1) * 24 * 60 * 60 * 1000);

    const result = await resolveSession({ sessionCodec, accountRepository }, token, muchLater);

    expect(result).toEqual({ ok: false, error: "unauthenticated" });
  });
});
