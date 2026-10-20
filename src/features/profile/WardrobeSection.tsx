import { useEffect, useMemo, useState } from "react";
import { useAppState } from "@/app/appState";
import { useServices } from "@/app/ServicesProvider";
import { useEquipToggle } from "@/app/useEquipToggle";
import type { ShopItem } from "@/domain/types";
import { CHARACTER_SLOTS, characterSlotOf, lookOf, type CharacterSlot } from "@/services/look";
import { fr } from "@/i18n/fr";
import { Button, Card, HeroMedallion, SectionTitle } from "@/ui";

// Hierarchy: the hero wearing each owned piece is the star; one quiet action per card.
export function WardrobeSection() {
  const { content } = useServices();
  const equipToggle = useEquipToggle();
  const wallet = useAppState((s) => s.wallet);
  const [items, setItems] = useState<ShopItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const equipped = wallet?.equipped;
  const base = useMemo(() => lookOf(equipped ?? {}), [equipped]);

  const starterLook = useMemo(() => {
    const look = { ...base };
    delete look.character;
    return look;
  }, [base]);

  useEffect(() => {
    let cancelled = false;
    content
      .getShop()
      .then((s) => !cancelled && setItems(s))
      .catch(() => undefined); // The section simply stays hidden.
    return () => {
      cancelled = true;
    };
  }, [content]);

  if (!items || !wallet) return null;

  const owned = items.filter((i) => characterSlotOf(i) !== null && wallet.inventory.includes(i.id) && fr.shop.items[i.id] !== undefined);

  async function toggle(id: string, slot: CharacterSlot, equippedNow: boolean, successTitle?: string): Promise<void> {
    if (busy) return;
    setBusy(true);
    try {
      await equipToggle(id, slot, equippedNow, successTitle);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="me-wardrobe-title" id="me-wardrobe" className="flex scroll-mt-4 flex-col gap-3">
      <SectionTitle id="me-wardrobe-title" overline={fr.ui.overline.wardrobe}>
        {fr.wardrobe.title}
      </SectionTitle>
      {CHARACTER_SLOTS.map((slot) => {
        const inSlot = owned.filter((i) => characterSlotOf(i) === slot);
        if (inSlot.length === 0 && slot !== "character") return null;
        return (
          <div key={slot} className="flex flex-col gap-2">
            <h3 className="text-body-strong text-ink-muted">{fr.wardrobe.slots[slot]}</h3>
            <ul className="grid list-none grid-cols-2 gap-3">
              {slot === "character" ? (
                <Card as="li" className="flex flex-col items-center gap-2 p-4 text-center">
                  <HeroMedallion look={starterLook} size={96} />
                  <h4 id="wardrobe-starter" className="text-body-strong text-ink">
                    {fr.shop.characters.starter}
                  </h4>
                  <p className={`text-caption text-gold-ink ${wallet.equipped.character === undefined ? "" : "invisible"}`}>{fr.rewards.equipped}</p>
                  <Button variant="secondary" fullWidth disabled={busy || wallet.equipped.character === undefined} aria-describedby="wardrobe-starter" onClick={() => void toggle("hero", "character", true, fr.wardrobe.starterToast)}>
                    {fr.shop.tryOn.equip}
                  </Button>
                </Card>
              ) : null}
              {inSlot.map((item) => {
                const text = fr.shop.items[item.id];
                if (!text) return null;
                const on = wallet.equipped[slot] === item.id;
                return (
                  <Card as="li" key={item.id} className="flex flex-col items-center gap-2 p-4 text-center">
                    <HeroMedallion look={{ ...base, [slot]: item.id }} size={96} />
                    <h4 id={`wardrobe-${item.id}`} className="text-body-strong text-ink">
                      {text.name}
                    </h4>
                    <p className={`text-caption text-gold-ink ${on ? "" : "invisible"}`}>{fr.rewards.equipped}</p>
                    {on && slot === "character" ? null : (
                      <Button variant="secondary" fullWidth disabled={busy} aria-describedby={`wardrobe-${item.id}`} onClick={() => void toggle(item.id, slot, on)}>
                        {on ? fr.shop.tryOn.unequip : fr.shop.tryOn.equip}
                      </Button>
                    )}
                  </Card>
                );
              })}
            </ul>
          </div>
        );
      })}
      {owned.length === 0 ? <p className="text-body text-ink-muted">{fr.wardrobe.empty}</p> : null}
    </section>
  );
}
