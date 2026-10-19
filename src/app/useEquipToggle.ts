import { useCallback } from "react";
import { useRefreshProgress } from "@/app/appState";
import { useServices } from "@/app/ServicesProvider";
import type { ItemSlot } from "@/domain/types";
import { fr } from "@/i18n/fr";
import { useToast } from "@/ui";

/**
 * Equip (or remove, when `equippedNow`) an item, refresh the wallet, and toast the outcome.
 * A stale screen after a successful equip is reported as an error: the player must not trust it.
 * Resolves true on a fully successful change. Callers own their busy lock.
 */
export function useEquipToggle(): (id: string, slot: ItemSlot, equippedNow: boolean, successTitle?: string) => Promise<boolean> {
  const { activity } = useServices();
  const toast = useToast();
  const refresh = useRefreshProgress();
  return useCallback(
    async (id, slot, equippedNow, successTitle) => {
      try {
        const r = await activity.equip(slot, equippedNow ? null : id);
        const refreshed = await refresh().then(() => true, () => false);
        const ok = r.ok && refreshed;
        toast.show({ title: ok ? (successTitle ?? (equippedNow ? fr.rewards.removedToast : fr.rewards.equippedToast)) : fr.rewards.error });
        return ok;
      } catch {
        toast.show({ title: fr.rewards.error });
        return false;
      }
    },
    [activity, toast, refresh],
  );
}
