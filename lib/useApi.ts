"use client";

import { useCallback, useEffect, useState } from "react";

type ApiState<T> = {
  data: T | undefined;
  error: unknown;
  /** True until the first response (success or failure) arrives. */
  loading: boolean;
  /** Re-runs the request; the previous data stays visible meanwhile. */
  reload: () => void;
  /** Replaces the cached data, e.g. with a mutation's response. */
  setData: (data: T) => void;
};

/**
 * Runs `fetcher` on mount and whenever `key` changes. State is only set in
 * promise callbacks, and responses from a superseded request are ignored.
 */
export function useApi<T>(fetcher: () => Promise<T>, key: unknown[]): ApiState<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<unknown>(null);
  const [settled, setSettled] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let active = true;
    fetcher().then(
      (result) => {
        if (!active) return;
        setData(result);
        setError(null);
        setSettled(true);
      },
      (err: unknown) => {
        if (!active) return;
        setError(err);
        setSettled(true);
      },
    );
    return () => {
      active = false;
    };
    // `fetcher` is usually an inline closure; `key` lists what it depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...key, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return { data, error, loading: !settled, reload, setData };
}
