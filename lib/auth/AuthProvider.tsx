"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ApiError, onSessionExpired, tokenStore } from "@/lib/api/client";
import { authApi, usersApi } from "@/lib/api/endpoints";
import type { User } from "@/lib/api/types";
import { setUnread } from "@/lib/unread";

/** "unreachable": there may be a session, but the server could not be asked yet. */
type AuthStatus = "loading" | "unreachable" | "authenticated" | "anonymous";
/** How the last session on this page ended. */
type SessionEnd = "expired" | "signedOut";

const RETRY = 5_000;

type AuthContextValue = {
  status: AuthStatus;
  user: User | null;
  ended: SessionEnd | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUserState] = useState<User | null>(null);
  const [ended, setEnded] = useState<SessionEnd | null>(null);

  const endSession = useCallback((reason: SessionEnd) => {
    setUserState(null);
    setStatus("anonymous");
    setEnded(reason);
    // The next account to sign in on this device must not see this one's count.
    setUnread(0);
  }, []);

  // Restore the session from stored tokens on first load.
  useEffect(() => {
    if (!tokenStore.access && !tokenStore.refresh) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from localStorage after hydration
      setStatus("anonymous");
      return;
    }
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function restore() {
      try {
        const me = await usersApi.me();
        if (stopped) return;
        setUserState(me);
        setStatus("authenticated");
      } catch (error) {
        if (stopped) return;
        if (error instanceof ApiError && error.status < 500 && error.status !== 429) {
          tokenStore.clear();
          setStatus("anonymous");
          return;
        }
        setStatus("unreachable");
        timer = setTimeout(restore, RETRY);
      }
    }
    void restore();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, []);

  // Pages that need an account send the visitor to sign-in themselves.
  useEffect(() => onSessionExpired(() => endSession("expired")), [endSession]);

  const login = useCallback(async (email: string, password: string) => {
    tokenStore.set(await authApi.login(email, password));
    const me = await usersApi.me();
    setUserState(me);
    setStatus("authenticated");
    setEnded(null);
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = tokenStore.refresh;
    tokenStore.clear();
    endSession("signedOut");
    if (refreshToken) {
      // Best effort: the local session is already gone even if this fails.
      await authApi.logout(refreshToken).catch(() => undefined);
    }
  }, [endSession]);

  const setUser = useCallback((next: User) => setUserState(next), []);

  const value = useMemo(
    () => ({ status, user, ended, login, logout, setUser }),
    [status, user, ended, login, logout, setUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
