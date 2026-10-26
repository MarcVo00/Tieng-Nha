import { useEffect, useMemo, useState } from "react";
import { useServices } from "@/app/ServicesProvider";
import { blowCue } from "@/domain/blowSound";
import type { SoundCue } from "@/domain/sound";
import type { Look, Rarity } from "@/domain/types";

/**
 * How a fighter's blows sound, from its look and the shop catalogue's rarities. Until the catalogue has loaded (or if
 * it fails), the weapon's family plays instead of a signature sound.
 */
export function useBlowCue(look: Look): SoundCue {
  const { content } = useServices();
  const [rarities, setRarities] = useState<ReadonlyMap<string, Rarity> | null>(null);
  useEffect(() => {
    let cancelled = false;
    content.getShop().then(
      (items) => {
        if (cancelled) return;
        const byId = new Map<string, Rarity>();
        for (const i of items) if (i.rarity) byId.set(i.id, i.rarity);
        setRarities(byId);
      },
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [content]);
  return useMemo(() => blowCue(look, (id) => rarities?.get(id) ?? null), [look, rarities]);
}
