import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAppState } from "@/app/appState";
import { useEquipToggle } from "@/app/useEquipToggle";
import { useServices } from "@/app/ServicesProvider";
import type { BadgeDef, ItemSlot, ShopItem } from "@/domain/types";
import { fr } from "@/i18n/fr";
import { Avatar, Button, Card, Icon, SectionTitle } from "@/ui";

// Frames by badge difficulty (bronze, jade, son mai), then the three effects.
const ORDER = ["frame_bronze", "frame_jade", "frame_son_mai", "fx_ink", "fx_lightning", "fx_embers"] as const;

// Hierarchy: the previews are the hero; one quiet action per card, locked cards say how to earn them.
export function RewardsSection({ badges }: { badges: BadgeDef[] | null }) {
  const { content } = useServices();
  const equipToggle = useEquipToggle();
  const wallet = useAppState((s) => s.wallet);
  const emoji = useAppState((s) => s.profile?.avatarEmoji ?? "");
  const [items, setItems] = useState<ShopItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const { hash } = useLocation();
  const ready = items !== null && wallet !== null;

  // Arriving from the shop hint (#me-rewards): bring the section into view once it exists.
  useEffect(() => {
    if (ready && hash === "#me-rewards") document.getElementById("me-rewards")?.scrollIntoView?.({ block: "start" });
  }, [ready, hash]);

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
  const rewards = ORDER.map((id) => items.find((i) => i.id === id)).filter((i): i is ShopItem => i !== undefined);
  if (rewards.length === 0) return null;

  async function toggle(id: string, slot: ItemSlot, equippedNow: boolean): Promise<void> {
    if (busy) return;
    setBusy(true);
    try {
      await equipToggle(id, slot, equippedNow);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="me-rewards-title" id="me-rewards" className="flex scroll-mt-4 flex-col gap-3">
      <SectionTitle id="me-rewards-title" overline={fr.ui.overline.rewards}>
        {fr.rewards.title}
      </SectionTitle>
      <ul className="grid list-none grid-cols-2 gap-3">
        {rewards.map((item) => {
          const text = fr.shop.items[item.id];
          if (!text) return null;
          const owned = wallet.inventory.includes(item.id);
          const slot = item.slot;
          if (slot === null) return null;
          const on = (slot === "frame" ? wallet.equipped.frame : wallet.equipped.profile_fx) === item.id;
          const badge = badges?.find((b) => b.reward === item.id);
          return (
            <Card as="li" key={item.id} className="flex flex-col items-center gap-2 p-4 text-center">
              <span role="img" aria-label={fr.rewards.preview(text.name)} className="relative flex h-20 w-20 items-center justify-center">
                <span className={owned ? "inline-flex" : "inline-flex opacity-50 grayscale"}>
                  <Avatar emoji={emoji} size="md" still={!owned} {...(slot === "frame" ? { frame: item.id } : { fx: item.id })} />
                </span>
                {owned ? null : (
                  <span className="absolute bottom-0 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-surface text-ink-muted shadow-card">
                    <Icon name="lock" size={14} />
                  </span>
                )}
              </span>
              <h3 id={`reward-${item.id}`} className="text-body-strong text-ink">{text.name}</h3>
              {owned ? (
                <>
                  {/* The line is always reserved (hidden when not equipped) so the buttons align across a row. */}
                  <p className={`text-caption text-gold-ink ${on ? "" : "invisible"}`}>{fr.rewards.equipped}</p>
                  <Button variant="secondary" fullWidth disabled={busy} aria-describedby={`reward-${item.id}`} onClick={() => void toggle(item.id, slot, on)}>
                    {on ? fr.rewards.unequip : fr.rewards.equip}
                  </Button>
                </>
              ) : (
                <p className="text-caption text-ink-muted">{badge ? fr.rewards.lockedBy(badge.title, badge.description) : text.desc}</p>
              )}
            </Card>
          );
        })}
      </ul>
    </section>
  );
}
