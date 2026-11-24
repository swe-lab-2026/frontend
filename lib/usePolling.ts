"use client";

import { useEffect, useRef } from "react";

/**
 * Calls `task` right away and then `delay` ms after each run finishes, so slow
 * responses never pile up. Pauses while the tab is hidden.
 */
export function usePolling(task: () => Promise<void>, delay: number) {
  const latest = useRef(task);
  useEffect(() => {
    latest.current = task;
  });

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let running = false;

    async function run() {
      if (stopped || running) return;
      clearTimeout(timer);
      running = true;
      if (!document.hidden) await latest.current().catch(() => undefined);
      running = false;
      if (!stopped) timer = setTimeout(run, delay);
    }
    const onVisible = () => {
      if (!document.hidden) void run();
    };

    void run();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [delay]);
}
