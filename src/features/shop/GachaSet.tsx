import { motion } from "motion/react";
import type { Look, ShopItem } from "@/domain/types";
import { fr } from "@/i18n/fr";
import { RARITY_ORDER } from "@/services/gacha";
import { characterSlotOf } from "@/services/look";
import { HeroMedallion, RarityBadge, tap } from "@/ui";

type Props = {
  items: readonly ShopItem[];
  inventory: readonly string[];
  baseLook: Look;
  busy: boolean;
  /** Try-on of any piece of the set (a preview only: nothing is bought here). */
  onOpen: (item: ShopItem) => void;
};

const rank = (i: ShopItem) => RARITY_ORDER.indexOf(i.rarity ?? "common");

// Hierarchy: pieces you own are in colour with a gold ring; the missing ones are dark silhouettes (same shape, no
// colour) so the set reads as a collection to complete. Every piece opens the try-on.
export function GachaSet({ items, inventory, baseLook, busy, onOpen }: Props) {
  const sorted = [...items].sort((a, b) => rank(b) - rank(a) || (a.id < b.id ? -1 : 1));
  return (
    <ul className="grid list-none grid-cols-2 gap-3">
      {sorted.map((item) => {
        const text = fr.shop.items[item.id];
        const slot = characterSlotOf(item);
        if (!text || slot === null || !item.rarity) return null;
        const owned = inventory.includes(item.id);
        return (
          <li key={item.id}>
            <motion.button
              type="button"
              whileTap={tap}
              disabled={busy}
              data-owned={owned}
              onClick={() => onOpen(item)}
              className="flex h-full w-full flex-col items-center gap-1.5 rounded-md bg-surface p-3 text-center shadow-card disabled:opacity-60"
            >
              <span className={owned ? "" : "[&_[data-look]]:opacity-30 [&_[data-look]]:brightness-0"}>
                <HeroMedallion look={{ ...baseLook, [slot]: item.id }} size={88} ring={owned ? "gold" : "neutral"} />
              </span>
              <span className="text-body-strong text-ink">
                <span className="sr-only">{fr.shop.tryOn.prefix} </span>
                {text.name}
              </span>
              <RarityBadge rarity={item.rarity} />
              <span className={`text-caption ${owned ? "text-gold-ink" : "text-ink-muted"}`}>{owned ? fr.shop.tryOn.owned : fr.gacha.notOwned}</span>
            </motion.button>
          </li>
        );
      })}
    </ul>
  );
}
