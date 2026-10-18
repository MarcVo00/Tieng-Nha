import { useEffect, useState } from "react";
import { useAppState, useRefreshProgress } from "@/app/appState";
import { useServices } from "@/app/ServicesProvider";
import type { BadgeDef, ItemSlot, ShopItem } from "@/domain/types";
import { fr } from "@/i18n/fr";
import { Avatar, Button, Card, Icon, useToast } from "@/ui";

// Frames by badge difficulty (bronze, jade, son mai), then the three effects.
const ORDER = ["frame_bronze", "frame_jade", "frame_son_mai", "fx_ink", "fx_lightning", "fx_embers"] as const;

const slotOf = (id: string): ItemSlot => (id.startsWith("fx_") ? "profile_fx" : "frame");

// Hierarchy: the previews are the hero; one quiet action per card, locked cards say how to earn them.
export function RewardsSection({ badges }: { badges: BadgeDef[] | null }) {
  const { content, activity } = useServices();
  const toast = useToast();
  const refresh = useRefreshProgress();
  const wallet = useAppState((s) => s.wallet);
  const emoji = useAppState((s) => s.profile?.avatarEmoji ?? "");
  const [items, setItems] = useState<ShopItem[] | null>(null);
  const [busy, setBusy] = useState(false);

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

  async function toggle(id: string, equippedNow: boolean): Promise<void> {
    if (busy) return;
    setBusy(true);
    try {
      const r = await activity.equip(slotOf(id), equippedNow ? null : id);
      await refresh().catch(() => undefined);
      toast.show({ title: r.ok ? (equippedNow ? fr.rewards.removedToast : fr.rewards.equippedToast) : fr.rewards.error });
    } catch {
      toast.show({ title: fr.rewards.error });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="me-rewards" className="flex flex-col gap-3">
      <h2 id="me-rewards" className="text-heading text-ink">
        {fr.rewards.title}
      </h2>
      <ul className="grid list-none grid-cols-2 gap-3">
        {rewards.map((item) => {
          const text = fr.shop.items[item.id];
          if (!text) return null;
          const owned = wallet.inventory.includes(item.id);
          const slot = slotOf(item.id);
          const on = (slot === "frame" ? wallet.equipped.frame : wallet.equipped.profile_fx) === item.id;
          const badge = badges?.find((b) => b.reward === item.id);
          return (
            <Card as="li" key={item.id} className={`flex flex-col items-center gap-2 p-4 text-center ${owned ? "" : "opacity-70"}`}>
              <span role="img" aria-label={fr.rewards.preview(text.name)} className="relative flex h-20 w-20 items-center justify-center">
                <Avatar emoji={emoji} size="md" {...(slot === "frame" ? { frame: item.id } : { fx: item.id })} />
                {owned ? null : (
                  <span className="absolute bottom-0 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-surface text-ink-muted shadow-card">
                    <Icon name="lock" size={14} />
                  </span>
                )}
              </span>
              <h3 className="text-body-strong text-ink">{text.name}</h3>
              {owned ? (
                <>
                  {on ? <p className="text-caption text-gold-ink">{fr.rewards.equipped}</p> : null}
                  <Button variant="secondary" fullWidth disabled={busy} aria-pressed={on} onClick={() => void toggle(item.id, on)}>
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
