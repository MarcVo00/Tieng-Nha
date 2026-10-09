import type { EventSink, Outbox } from "@/ports";

export type Timers = { setTimeout: (fn: () => void, ms: number) => unknown; clearTimeout: (h: unknown) => void };
export type SyncService = {
  start(): void;
  stop(): void;
  flush(): Promise<{ sent: number }>;
  onSizeChange(cb: (n: number) => void): () => void;
  notifyEnqueued(): void;
};
export const BACKOFF_MS = [2000, 4000, 8000, 16000, 32000, 64000, 128000, 300000];

const defaultTimers: Timers = {
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (h) => globalThis.clearTimeout(h as ReturnType<typeof setTimeout>),
};
const defaultOnline = (cb: () => void) => {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("online", cb);
  return () => window.removeEventListener("online", cb);
};

export function createSyncService(deps: {
  outbox: Outbox;
  sink: EventSink;
  timers?: Timers;
  batchSize?: number;
  addOnlineListener?: (cb: () => void) => () => void;
}): SyncService {
  const timers = deps.timers ?? defaultTimers;
  const batch = deps.batchSize ?? 50;
  const listeners = new Set<(n: number) => void>();
  let inflight: Promise<{ sent: number }> | null = null;
  let retryHandle: unknown = null;
  let attempt = 0;
  let unlisten: (() => void) | null = null;
  let running = false;

  const notify = async () => {
    try {
      const n = await deps.outbox.size();
      listeners.forEach((l) => l(n));
    } catch {
      // size reporting is best-effort; never let it break a flush
    }
  };
  let dirty = false;
  const scheduleRetry = () => {
    if (!running || retryHandle !== null) return;
    const delay = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)] ?? 300000;
    attempt++;
    retryHandle = timers.setTimeout(() => {
      retryHandle = null;
      void flush();
    }, delay);
  };

  async function pass(): Promise<number> {
    let sent = 0;
    try {
      for (;;) {
        const events = await deps.outbox.peek(batch);
        if (events.length === 0) break;
        const { accepted } = await deps.sink.push(events);
        if (accepted.length === 0) throw new Error("batch rejected");
        await deps.outbox.ack(accepted);
        sent += accepted.length;
      }
      attempt = 0;
    } catch {
      scheduleRetry();
    }
    return sent;
  }

  async function run(): Promise<{ sent: number }> {
    let sent = 0;
    do {
      dirty = false;
      sent += await pass();
    } while (dirty);
    await notify();
    return { sent };
  }

  function flush(): Promise<{ sent: number }> {
    if (inflight) {
      dirty = true; // a run is in progress: make it go around once more
      return inflight;
    }
    inflight = run().finally(() => {
      inflight = null;
    });
    return inflight;
  }

  return {
    flush,
    start() {
      if (running) return;
      running = true;
      unlisten = (deps.addOnlineListener ?? defaultOnline)(() => {
        attempt = 0;
        void flush();
      });
      void flush();
    },
    stop() {
      running = false;
      unlisten?.();
      unlisten = null;
      if (retryHandle !== null) timers.clearTimeout(retryHandle);
      retryHandle = null;
    },
    onSizeChange(cb) {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    notifyEnqueued() {
      void notify();
      void flush();
    },
  };
}
