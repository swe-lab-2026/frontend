"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { onSessionExpired, tokenStore } from "@/lib/api/client";
import { authApi, usersApi } from "@/lib/api/endpoints";
import type { User } from "@/lib/api/types";

type AuthStatus = "loading" | "authenticated" | "anonymous";

type AuthContextValue = {
  status: AuthStatus;
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUserState] = useState<User | null>(null);

  // Restore the session from stored tokens on first load.
  useEffect(() => {
    if (!tokenStore.access && !tokenStore.refresh) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from localStorage after hydration
      setStatus("anonymous");
      return;
    }
    usersApi
      .me()
      .then((me) => {
        setUserState(me);
        setStatus("authenticated");
      })
      .catch(() => {
        tokenStore.clear();
        setStatus("anonymous");
      });
  }, []);

  useEffect(
    () =>
      onSessionExpired(() => {
        setUserState(null);
        setStatus("anonymous");
        router.replace("/login?expired=1");
      }),
    [router],
  );

  const login = useCallback(async (email: string, password: string) => {
    tokenStore.set(await authApi.login(email, password));
    const me = await usersApi.me();
    setUserState(me);
    setStatus("authenticated");
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = tokenStore.refresh;
    tokenStore.clear();
    setUserState(null);
    setStatus("anonymous");
    if (refreshToken) {
      // Best effort: the local session is already gone even if this fails.
      await authApi.logout(refreshToken).catch(() => undefined);
    }
  }, []);

  const setUser = useCallback((next: User) => setUserState(next), []);

  const value = useMemo(
    () => ({ status, user, login, logout, setUser }),
    [status, user, login, logout, setUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
