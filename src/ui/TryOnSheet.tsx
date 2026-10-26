import { useEffect, useState } from "react";
import type { Look, ShopItem, Wallet } from "@/domain/types";
import { fr } from "@/i18n/fr";
import { Button } from "@/ui/Button";
import { HeroMedallion } from "@/ui/HeroMedallion";
import { Icon } from "@/ui/icons";
import { RarityBadge } from "@/ui/RarityBadge";
import { Sheet } from "@/ui/Sheet";

type TryOnSheetProps = {
  item: ShopItem | null;
  open: boolean;
  wallet: Wallet;
  /** What the hero wears now; the item is added on top of it. */
  baseLook: Look;
  busy: boolean;
  /** The character slot the item goes into (callers compute it with `characterSlotOf`), null for a non-wearable item. */
  slot: keyof Look | null;
  /** Why the last purchase attempt was refused (shown in the sheet, announced). Cleared by the caller. */
  purchaseMessage?: string | null;
  onClose: () => void;
  /** Absent in the gacha shop, where nothing is bought. */
  onBuy?: (item: ShopItem) => Promise<void>;
  onToggle: (item: ShopItem, equippedNow: boolean) => Promise<void>;
};

// Hierarchy: the hero wearing the item is the star; the name and the price are secondary; one action.
// The purchase confirmation happens inside this same sheet (never a second modal on top of it).
export function TryOnSheet({ item, open, wallet, baseLook, busy, slot, purchaseMessage = null, onClose, onBuy, onToggle }: TryOnSheetProps) {
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (!open) setConfirming(false);
  }, [open]);

  const text = item ? fr.shop.items[item.id] : undefined;
  const price = item?.price ?? null;
  // Arena items are paid in Kim bài (gold medal), everything else in xu.
  const kim = item?.currency === "kim_bai";

  async function buy(it: ShopItem): Promise<void> {
    await onBuy?.(it);
    setConfirming(false);
  }

  function body() {
    if (!item || !text || !slot) return null;
    const owned = wallet.inventory.includes(item.id);
    const on = wallet.equipped[slot] === item.id;
    const funds = kim ? wallet.kimBai : wallet.coins;
    // A gacha piece (rarity, no price) is never sold: not owned = « se gagne au tirage », no buy button.
    const gachaOnly = item.rarity !== undefined && price === null;
    const poor = !owned && (price === null || funds < price);
    const look: Look = { ...baseLook, [slot]: item.id };
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <HeroMedallion look={look} size={208} ring={owned ? "gold" : "neutral"} label={fr.shop.tryOn.preview(text.name)} />
        {confirming && price !== null ? (
          <>
            <h2 className="text-heading text-ink">{kim ? fr.arena.confirmTitle(text.confirmName, price) : fr.shop.confirm.title(text.confirmName, price)}</h2>
            <div className="flex w-full flex-col-reverse gap-2">
              <Button variant="secondary" fullWidth disabled={busy} autoFocus onClick={() => setConfirming(false)}>
                {fr.shop.confirm.cancel}
              </Button>
              <Button fullWidth loading={busy} disabled={busy} onClick={() => void buy(item)}>
                {fr.shop.confirm.confirm}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div>
              <h2 className="text-heading text-ink">{text.name}</h2>
              {item.rarity ? <RarityBadge rarity={item.rarity} className="mt-1" /> : null}
              <p className="mt-1 text-body text-ink-muted">{text.desc}</p>
            </div>
            {owned ? (
              <p className={`text-caption ${on ? "text-gold-ink" : "text-ink-muted"}`}>{on ? fr.shop.tryOn.equipped : fr.shop.tryOn.owned}</p>
            ) : gachaOnly ? (
              <p className="text-caption text-ink-muted">{fr.gacha.sheetHint}</p>
            ) : poor ? (
              <p className="text-caption text-ink-muted">{kim ? fr.arena.notEnough : fr.shop.noFunds}</p>
            ) : (
              <p className="tabular flex items-center gap-1 text-caption text-gold-ink">
                <Icon name={kim ? "medal" : "coin"} size={16} className="text-gold" />
                {kim ? fr.duels.kimBai(price ?? 0) : fr.shop.balance(price ?? 0)}
              </p>
            )}
            {purchaseMessage ? (
              <p role="alert" className="rounded-md bg-surface-2 p-3 text-body text-ink">
                {purchaseMessage}
              </p>
            ) : null}
            {owned ? (
              <Button fullWidth autoFocus loading={busy} disabled={busy} onClick={() => void onToggle(item, on)}>
                {on ? fr.shop.tryOn.unequip : fr.shop.tryOn.equip}
              </Button>
            ) : gachaOnly || !onBuy ? (
              <Button variant="secondary" fullWidth autoFocus onClick={onClose}>
                {fr.gacha.close}
              </Button>
            ) : (
              <Button fullWidth autoFocus disabled={poor || busy} onClick={() => setConfirming(true)}>
                {kim ? fr.arena.buy(price ?? 0) : fr.shop.tryOn.buy(price ?? 0)}
              </Button>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <Sheet open={open} onClose={() => !busy && onClose()} label={text?.name ?? fr.shop.title}>
      {body()}
    </Sheet>
  );
}
