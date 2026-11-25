import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { allPages } from "@/lib/api/endpoints";
import { ApiError, apiRequest, onSessionExpired, tokenStore } from "@/lib/api/client";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal("window", {});
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
  });
});

afterEach(() => vi.unstubAllGlobals());

describe("apiRequest", () => {
  it("parses the backend error envelope and field errors", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      json(422, {
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: { errors: [{ loc: ["body", "title"], msg: "Value error, must not be blank", type: "value_error" }] },
        },
      }),
    ));
    const error = (await apiRequest("/events", { method: "POST", body: {} }).catch((e: unknown) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.fieldErrors()).toEqual({ title: "must not be blank" });
  });

  it("sends a file as multipart, letting the browser set the boundary", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => json(201, { object_key: "k" }));
    vi.stubGlobal("fetch", fetchMock);
    const form = new FormData();
    form.append("file", new Blob(["x"], { type: "image/png" }), "a.png");
    await apiRequest("/events/1/images/upload", { method: "POST", body: form });
    const init = fetchMock.mock.calls[0][1]!;
    expect(init.body).toBe(form);
    expect(init.headers).not.toHaveProperty("Content-Type");
  });

  it("refreshes once for concurrent 401s and retries both requests", async () => {
    tokenStore.set({ access_token: "old", refresh_token: "r1", token_type: "bearer", expires_in: 900 });
    let refreshCalls = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith("/auth/refresh")) {
        refreshCalls += 1;
        return json(200, { access_token: "new", refresh_token: "r2", token_type: "bearer", expires_in: 900 });
      }
      const auth = (init.headers as Record<string, string>).Authorization;
      return auth === "Bearer new" ? json(200, { ok: true }) : json(401, { error: { code: "TOKEN_EXPIRED", message: "", details: {} } });
    }));

    const results = await Promise.all([apiRequest("/users/me"), apiRequest("/events")]);
    expect(results).toEqual([{ ok: true }, { ok: true }]);
    // The backend treats reuse of a rotated refresh token as theft.
    expect(refreshCalls).toBe(1);
    expect(tokenStore.refresh).toBe("r2");
  });

  it("clears tokens and notifies when refresh fails", async () => {
    tokenStore.set({ access_token: "old", refresh_token: "r1", token_type: "bearer", expires_in: 900 });
    vi.stubGlobal("fetch", vi.fn(async () => json(401, { error: { code: "TOKEN_INVALID", message: "", details: {} } })));
    const expired = vi.fn();
    const unsubscribe = onSessionExpired(expired);

    await expect(apiRequest("/users/me")).rejects.toBeInstanceOf(ApiError);
    expect(expired).toHaveBeenCalledOnce();
    expect(tokenStore.access).toBeNull();
    unsubscribe();
  });

  it.each([
    ["the refresh call fails", async () => { throw new TypeError("Failed to fetch"); }],
    ["the server is restarting", async () => new Response("Internal Server Error", { status: 500 })],
    ["the refresh call is rate limited", async () => json(429, { error: { code: "RATE_LIMITED", message: "", details: {} } })],
  ])("keeps the session when %s", async (_name, refresh) => {
    tokenStore.set({ access_token: "old", refresh_token: "r1", token_type: "bearer", expires_in: 900 });
    vi.stubGlobal("fetch", vi.fn(async (url: string) =>
      url.endsWith("/auth/refresh") ? refresh() : json(401, { error: { code: "TOKEN_EXPIRED", message: "", details: {} } })));
    const expired = vi.fn();
    const unsubscribe = onSessionExpired(expired);

    await expect(apiRequest("/users/me")).rejects.toBeInstanceOf(Error);
    expect(expired).not.toHaveBeenCalled();
    expect(tokenStore.refresh).toBe("r1");
    unsubscribe();
  });
});

describe("allPages", () => {
  const rows = (n: number) => Array.from({ length: n }, (_, i) => i);
  it.each([0, 1, 99, 100, 101, 250])("reads all %i rows", async (n) => {
    const load = vi.fn(async ({ limit, offset }: { limit: number; offset: number }) => rows(n).slice(offset, offset + limit));
    expect(await allPages(100, load)).toEqual(rows(n));
    expect(load).toHaveBeenCalledTimes(Math.floor(n / 100) + 1);
  });
});
