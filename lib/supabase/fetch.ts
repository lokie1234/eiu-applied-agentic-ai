/** Coalesce only reads that are already in flight; never cache authorization results. */
export function createSupabaseFetch(fetcher: typeof fetch = fetch, requestSignal?: AbortSignal): typeof fetch {
  type PendingRead = { promise: Promise<Response>; controller: AbortController; consumers: number; settled: boolean };
  const pending = new Map<string, PendingRead>();
  const shareableTables = new Set(["courses", "course_sections", "section_state", "admin_credentials"]);

  return async (input, init) => {
    const request = input instanceof Request ? input : null;
    const url = new URL(request?.url ?? String(input));
    const method = (init?.method ?? request?.method ?? "GET").toUpperCase();
    const reading = method === "GET" || method === "HEAD";
    const rest = url.pathname.startsWith("/rest/v1/");
    const table = url.pathname.split("/").at(-1) ?? "";
    const signal = init?.signal ?? request?.signal;
    const consumerSignal = signal && requestSignal ? AbortSignal.any([signal, requestSignal]) : signal ?? requestSignal;
    consumerSignal?.throwIfAborted();
    const shareable = rest && reading && shareableTables.has(url.pathname.split("/").at(-1) ?? "") && pending.size < 100;
    const headers = new Headers(init?.headers ?? request?.headers);
    const key = JSON.stringify([method, url.href, [...headers.entries()].sort()]);
    // Heartbeats/audit writes do not change catalog permissions. Only mutations
    // to shared tables invalidate pending shared reads, before and after writing.
    const invalidatesReads = rest && !reading && shareableTables.has(table);
    if (invalidatesReads) pending.clear();

    const run = (controller?: AbortController) => {
      const timeout = rest ? reading ? 15_000 : 30_000 : 90_000;
      const signals = [AbortSignal.timeout(timeout)];
      if (controller) signals.push(controller.signal);
      else if (consumerSignal) signals.push(consumerSignal);
      return fetcher(input, { ...init, signal: AbortSignal.any(signals) });
    };
    if (!shareable) {
      try { return await run(); }
      finally { if (invalidatesReads) pending.clear(); }
    }

    let entry = pending.get(key);
    if (!entry) {
      const controller = new AbortController();
      entry = { controller, consumers: 0, settled: false, promise: run(controller) };
      const created = entry;
      created.promise = created.promise.finally(() => {
        created.settled = true;
        if (pending.get(key) === created) pending.delete(key);
      });
      pending.set(key, created);
    }
    const shared = entry;
    shared.consumers++;
    let onAbort: (() => void) | undefined;
    try {
      const aborted = new Promise<never>((_, reject) => {
        onAbort = () => reject(consumerSignal?.reason ?? new DOMException("Aborted", "AbortError"));
        consumerSignal?.addEventListener("abort", onAbort, { once: true });
        if (consumerSignal?.aborted) onAbort();
      });
      const response = await Promise.race([shared.promise, aborted]);
      return response.clone();
    } finally {
      if (onAbort) consumerSignal?.removeEventListener("abort", onAbort);
      shared.consumers--;
      if (!shared.settled && shared.consumers === 0) {
        if (pending.get(key) === shared) pending.delete(key);
        shared.controller.abort();
      }
    }
  };
}
