import type { ApiErrorBody, TokenResponse, ValidationIssue } from "./types";

// Same-origin path; next.config.ts proxies it to the FastAPI backend.
export const API_BASE = "/api/v1";

const ACCESS_KEY = "bf.access_token";
const REFRESH_KEY = "bf.refresh_token";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details: ApiErrorBody["error"]["details"] = {},
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** Pydantic field errors keyed by field name (last element of `loc`). */
  fieldErrors(): Record<string, string> {
    const result: Record<string, string> = {};
    const errors = this.details.errors;
    if (!Array.isArray(errors)) return result;
    for (const issue of errors) {
      if (typeof issue === "string") continue;
      const { loc, msg } = issue as ValidationIssue;
      const field = loc.filter((part) => part !== "body").join(".") || "_";
      result[field] ??= msg.replace(/^Value error, /, "");
    }
    return result;
  }

  /** Plain-string error list, e.g. publish-readiness errors. */
  messages(): string[] {
    const errors = this.details.errors;
    if (!Array.isArray(errors)) return [];
    return errors.map((issue) =>
      typeof issue === "string" ? issue : (issue as ValidationIssue).msg,
    );
  }
}

// ---------- Token storage ----------
// Tokens live in localStorage so a page reload keeps the session. Trade-off:
// any XSS can read them; an httpOnly-cookie BFF would be safer for production.

export const tokenStore = {
  get access(): string | null {
    return typeof window === "undefined" ? null : localStorage.getItem(ACCESS_KEY);
  },
  get refresh(): string | null {
    return typeof window === "undefined" ? null : localStorage.getItem(REFRESH_KEY);
  },
  set(pair: TokenResponse) {
    localStorage.setItem(ACCESS_KEY, pair.access_token);
    localStorage.setItem(REFRESH_KEY, pair.refresh_token);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

type Listener = () => void;
const sessionExpiredListeners = new Set<Listener>();

/** Notified when refresh fails and the user must sign in again. */
export function onSessionExpired(listener: Listener): () => void {
  sessionExpiredListeners.add(listener);
  return () => sessionExpiredListeners.delete(listener);
}

// ---------- Request ----------

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  auth?: boolean;
  query?: Record<string, string | number | undefined>;
};

async function parseError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as ApiErrorBody;
    if (body?.error) {
      return new ApiError(response.status, body.error.code, body.error.message, body.error.details);
    }
  } catch {
    // Non-JSON error (e.g. proxy failure when the backend is down).
  }
  return new ApiError(response.status, "HTTP_ERROR", response.statusText || "Request failed");
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) params.set(key, String(value));
  }
  const qs = params.toString();
  return `${API_BASE}${path}${qs ? `?${qs}` : ""}`;
}

async function send(path: string, options: RequestOptions, token: string | null) {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(buildUrl(path, options.query), {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

// One refresh at a time: the backend rotates refresh tokens and treats reuse
// of an old one as theft (REFRESH_TOKEN_REUSED), so parallel 401s must share
// a single refresh call.
let refreshInFlight: Promise<boolean> | null = null;

export function refreshTokens(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  const refreshToken = tokenStore.refresh;
  if (!refreshToken) return Promise.resolve(false);

  refreshInFlight = (async () => {
    try {
      const response = await send("/auth/refresh", { method: "POST", body: { refresh_token: refreshToken } }, null);
      if (!response.ok) return false;
      tokenStore.set((await response.json()) as TokenResponse);
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const useAuth = options.auth ?? true;
  let response = await send(path, options, useAuth ? tokenStore.access : null);

  if (response.status === 401 && useAuth && tokenStore.refresh) {
    if (await refreshTokens()) {
      response = await send(path, options, tokenStore.access);
    } else {
      tokenStore.clear();
      sessionExpiredListeners.forEach((listener) => listener());
    }
  }

  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
