import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchMe, login, logout } from "./api.js";

function mockFetch(response: { status: number; body?: unknown }) {
  return vi.fn().mockResolvedValue({
    status: response.status,
    ok: response.status >= 200 && response.status < 300,
    json: () => Promise.resolve(response.body),
  });
}

describe("fetchMe", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the account when the session is valid", async () => {
    vi.stubGlobal("fetch", mockFetch({ status: 200, body: { id: "u1", firstName: "Alex", grade: "CP" } }));

    expect(await fetchMe()).toEqual({ id: "u1", firstName: "Alex", grade: "CP" });
  });

  it("returns null when there is no session (401), never throwing", async () => {
    vi.stubGlobal("fetch", mockFetch({ status: 401 }));

    expect(await fetchMe()).toBeNull();
  });

  it("throws on an unexpected server error", async () => {
    vi.stubGlobal("fetch", mockFetch({ status: 500 }));

    await expect(fetchMe()).rejects.toThrow();
  });
});

describe("login", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok on success (204)", async () => {
    vi.stubGlobal("fetch", mockFetch({ status: 204 }));

    expect(await login("alex", "s3cret")).toEqual({ ok: true });
  });

  it("returns the generic invalid_credentials error on 401", async () => {
    vi.stubGlobal("fetch", mockFetch({ status: 401, body: { error: "invalid_credentials" } }));

    expect(await login("alex", "wrong")).toEqual({ ok: false, error: "invalid_credentials" });
  });

  it("returns the rate_limited error on 429", async () => {
    vi.stubGlobal("fetch", mockFetch({ status: 429, body: { error: "rate_limited" } }));

    expect(await login("alex", "wrong")).toEqual({ ok: false, error: "rate_limited" });
  });
});

describe("logout", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts to /api/auth/logout", async () => {
    const fetchMock = mockFetch({ status: 204 });
    vi.stubGlobal("fetch", fetchMock);

    await logout();

    expect(fetchMock).toHaveBeenCalledWith("/api/auth/logout", expect.objectContaining({ method: "POST" }));
  });
});
