import type { MeResponse } from "@studiakids/contracts";
import { HttpError } from "./http-error.js";

export type LoginResult = { ok: true } | { ok: false; error: "invalid_credentials" | "rate_limited" };

// Returns null for "not logged in" (401) rather than throwing: that is an
// expected, common state for this call, not a failure — only an
// unexpected status throws, for the caller's error state.
export async function fetchMe(): Promise<MeResponse | null> {
  const res = await fetch("/api/me");
  if (res.status === 401) return null;
  if (!res.ok) throw new HttpError(res.status, "GET /api/me");
  return (await res.json()) as MeResponse;
}

export async function login(username: string, password: string): Promise<LoginResult> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (res.status === 204) return { ok: true };
  if (res.status === 401) return { ok: false, error: "invalid_credentials" };
  if (res.status === 429) return { ok: false, error: "rate_limited" };
  throw new Error(`POST /api/auth/login failed with status ${String(res.status)}`);
}

export async function logout(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" });
}
