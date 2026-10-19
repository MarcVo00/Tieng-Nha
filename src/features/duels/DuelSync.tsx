import { useEffect } from "react";
import { useServices } from "@/app/ServicesProvider";
import { OfflineError } from "@/domain/errors";
import { clearPending, clearRun, readUnsent, unsentDuelIds } from "@/features/duels/duelRunState";

/**
 * Delivers finished duel runs that never reached the server (closed app, no network), without any UI:
 * on mount and whenever the network comes back. Offline: quiet, retried on the next `online`.
 * Accepted, `already_submitted` and `not_open` all mean the run has nothing left to do and are cleared;
 * any other error keeps the run on the phone (it is retried at the next start, never in a loop).
 */
export function DuelSync() {
  const { duels } = useServices();

  useEffect(() => {
    let running = false;
    let stopped = false;

    const deliver = async () => {
      if (running) return;
      running = true;
      try {
        for (const id of unsentDuelIds()) {
          if (stopped) return;
          const run = readUnsent(id);
          if (!run) continue;
          try {
            const res = await duels.submitRun(id, run.round1, run.round2);
            if (res.ok || res.error === "already_submitted" || res.error === "not_open") {
              clearPending(id);
              clearRun(id);
            }
          } catch (e) {
            if (e instanceof OfflineError) return; // the network is gone: wait for `online`
          }
        }
      } finally {
        running = false;
      }
    };

    void deliver();
    window.addEventListener("online", deliver);
    return () => {
      stopped = true;
      window.removeEventListener("online", deliver);
    };
  }, [duels]);

  return null;
}
