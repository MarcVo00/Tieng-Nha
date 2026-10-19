import { useEffect, useState } from "react";
import { useServices } from "@/app/ServicesProvider";
import type { Duel } from "@/domain/types";

/**
 * Open duels I still have to play (not expired), read quietly: offline or failing, the list is simply empty.
 * Used by the home banner and the « Duels » entry; the duels hub does its own, louder, loading.
 */
export function usePendingDuels(): Duel[] {
  const { duels, clock } = useServices();
  const [pending, setPending] = useState<Duel[]>([]);
  useEffect(() => {
    let cancelled = false;
    duels
      .list()
      .then((all) => {
        if (cancelled) return;
        const now = Date.parse(clock());
        setPending(all.filter((d) => d.status === "open" && d.myRun === null && Date.parse(d.expiresAt) > now));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [duels, clock]);
  return pending;
}
