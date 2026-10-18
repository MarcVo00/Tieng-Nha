import { useEffect, useState } from "react";
import type { Look, ShopItem, Wallet } from "@/domain/types";
import { characterSlotOf } from "@/services/look";
import { fr } from "@/i18n/fr";
import { Button, HeroMedallion, Icon, Sheet } from "@/ui";

type TryOnSheetProps = {
  item: ShopItem | null;
  open: boolean;
  wallet: Wallet;
  /** What the hero wears now; the item is added on top of it. */
  baseLook: Look;
  busy: boolean;
  onClose: () => void;
  onBuy: (item: ShopItem) => Promise<void>;
  onToggle: (item: ShopItem, equippedNow: boolean) => Promise<void>;
};

// Hierarchy: the hero wearing the item is the star; the name and the price are secondary; one action.
// The purchase confirmation happens inside this same sheet (never a second modal on top of it).
export function TryOnSheet({ item, open, wallet, baseLook, busy, onClose, onBuy, onToggle }: TryOnSheetProps) {
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (!open) setConfirming(false);
  }, [open]);

  const text = item ? fr.shop.items[item.id] : undefined;
  const slot = characterSlotOf(item ?? { slot: null });
  const price = item?.price ?? null;

  async function buy(it: ShopItem): Promise<void> {
    await onBuy(it);
    setConfirming(false);
  }

  function body() {
    if (!item || !text || !slot) return null;
    const owned = wallet.inventory.includes(item.id);
    const on = wallet.equipped[slot] === item.id;
    const poor = !owned && (price === null || wallet.coins < price);
    const look: Look = { ...baseLook, [slot]: item.id };
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <HeroMedallion look={look} size={208} label={fr.shop.tryOn.preview(text.name)} />
        {confirming && price !== null ? (
          <>
            <h2 className="text-heading text-ink">{fr.shop.confirm.title(text.confirmName, price)}</h2>
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
              <p className="mt-1 text-body text-ink-muted">{text.desc}</p>
            </div>
            {owned ? (
              <p className={`text-caption ${on ? "text-gold-ink" : "text-ink-muted"}`}>{on ? fr.shop.tryOn.equipped : fr.shop.tryOn.owned}</p>
            ) : poor ? (
              <p className="text-caption text-ink-muted">{fr.shop.noFunds}</p>
            ) : (
              <p className="tabular flex items-center gap-1 text-caption text-gold-ink">
                <Icon name="coin" size={16} className="text-gold" />
                {fr.shop.balance(price ?? 0)}
              </p>
            )}
            {owned ? (
              <Button fullWidth autoFocus loading={busy} disabled={busy} onClick={() => void onToggle(item, on)}>
                {on ? fr.shop.tryOn.unequip : fr.shop.tryOn.equip}
              </Button>
            ) : (
              <Button fullWidth autoFocus disabled={poor || busy} onClick={() => setConfirming(true)}>
                {fr.shop.tryOn.buy(price ?? 0)}
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
