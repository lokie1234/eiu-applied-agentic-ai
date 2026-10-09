"use client";

import { useCallback, useEffect, useRef } from "react";

/** Polls and broadcasts share one request; a burst schedules at most one follow-up. */
export function createRefreshRunner(load: (signal: AbortSignal) => Promise<void>) {
  let active: Promise<void> | null = null;
  let controller: AbortController | null = null;
  let queued = false;
  let disposed = false;
  return {
    refresh(): Promise<void> {
      if (disposed) return Promise.resolve();
      if (active) { queued = true; return active; }
      active = (async () => {
        do {
          queued = false;
          controller = new AbortController();
          await load(AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]));
        } while (queued && !disposed);
      })().finally(() => { active = null; controller = null; });
      return active;
    },
    dispose() { disposed = true; queued = false; controller?.abort(); },
  };
}

export function useLiveRefresh(load: (signal: AbortSignal) => Promise<void>) {
  const runner = useRef<ReturnType<typeof createRefreshRunner> | null>(null);
  useEffect(() => {
    const current = createRefreshRunner(load);
    runner.current = current;
    return () => { current.dispose(); if (runner.current === current) runner.current = null; };
  }, [load]);
  return useCallback(() => runner.current?.refresh() ?? Promise.resolve(), []);
}

export function cancelledRefresh(signal: AbortSignal) {
  return signal.aborted && signal.reason?.name !== "TimeoutError";
}
