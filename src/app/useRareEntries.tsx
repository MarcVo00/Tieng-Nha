import type { Look, ShopItem, Wallet } from "@/domain/types";
import { fr } from "@/i18n/fr";
import { characterSlotOf } from "@/services/look";
import { Icon, type RareEntry } from "@/ui";

type Options = {
  items: readonly ShopItem[];
  wallet: Wallet;
  baseLook: Look;
  busy: boolean;
  onOpen: (item: ShopItem) => void;
  /** Currency of the price line: coins in the shop, Kim bài in the arena. */
  currency: { icon: "coin" | "medal"; label: (price: number) => string };
};

/** The rare-showcase rows shared by the shop (themed pieces) and the arena (Kim bài pieces). */
export function rareEntriesOf({ items, wallet, baseLook, busy, onOpen, currency }: Options): RareEntry[] {
  const out: RareEntry[] = [];
  for (const item of items) {
    const text = fr.shop.items[item.id];
    const slot = characterSlotOf(item);
    if (!text || slot === null) continue;
    const owned = wallet.inventory.includes(item.id);
    const on = wallet.equipped[slot] === item.id;
    out.push({
      id: item.id,
      look: { ...baseLook, [slot]: item.id },
      name: text.name,
      desc: text.desc,
      owned,
      disabled: busy,
      onOpen: () => onOpen(item),
      status: owned ? (
        <span className={`text-caption ${on ? "text-gold-ink" : "text-ink-muted"}`}>{on ? fr.shop.tryOn.equipped : fr.shop.tryOn.owned}</span>
      ) : (
        <span className="tabular inline-flex items-center gap-1 text-caption text-gold-ink">
          <Icon name={currency.icon} size={16} className="text-gold" />
          {currency.label(item.price ?? 0)}
        </span>
      ),
    });
  }
  return out;
}
