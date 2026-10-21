import { createContext, useContext, useEffect, useState } from "react";
import { useServices } from "@/app/ServicesProvider";
import type { Duel } from "@/domain/types";

const seenKey = (id: string): string => `tn-duel-seen:${id}`;

/** Whether this device has already shown the result of a finished duel (the celebration plays once). */
export function wasResultSeen(id: string): boolean {
  try {
    return localStorage.getItem(seenKey(id)) === "true";
  } catch {
    return false;
  }
}

export function markResultSeen(id: string): void {
  try {
    localStorage.setItem(seenKey(id), "true");
  } catch {
    // storage unavailable: the result may be announced again, nothing worse
  }
}

export type DuelSummary = {
  /** Open duels I still have to play (not expired). */
  pending: Duel[];
  /** Settled duels whose result this device has not shown yet, newest first. */
  unseen: Duel[];
};

/**
 * Reads my duels quietly (offline or failing: both lists are empty) for the home banner and the « Duels » entry;
 * the duels hub does its own, louder, loading.
 */
export function useDuelSummary(refreshKey = "", enabled = true): DuelSummary {
  const { duels, clock } = useServices();
  const [summary, setSummary] = useState<DuelSummary>({ pending: [], unseen: [] });
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    duels
      .list()
      .then((all) => {
        if (cancelled) return;
        const now = Date.parse(clock());
        setSummary({
          pending: all.filter((d) => d.status === "open" && d.myRun === null && Date.parse(d.expiresAt) > now),
          unseen: all
            .filter((d) => d.status === "settled" && !wasResultSeen(d.id))
            .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [duels, clock, refreshKey, enabled]);
  return summary;
}

/** Set by the tab layout: the one fetch of the pending duels, shared by the tab badge and the Arène segments. */
export const PendingDuelsContext = createContext<Duel[] | null>(null);

/** Open duels I still have to play (not expired). Inside the tab layout, reads the layout's single fetch. */
export function usePendingDuels(refreshKey = ""): Duel[] {
  const shared = useContext(PendingDuelsContext);
  const own = useDuelSummary(refreshKey, shared === null);
  return shared ?? own.pending;
}
