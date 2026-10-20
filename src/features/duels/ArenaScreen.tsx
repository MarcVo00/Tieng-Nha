import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { useAppState, useRefreshProgress } from "@/app/appState";
import { useServices } from "@/app/ServicesProvider";
import { useEquipToggle } from "@/app/useEquipToggle";
import { OfflineError } from "@/domain/errors";
import type { ShopItem } from "@/domain/types";
import { characterSlotOf } from "@/services/look";
import { useHeroLook } from "@/app/useHeroLook";
import { rareEntriesOf } from "@/app/useRareEntries";
import { fr } from "@/i18n/fr";
import { BalanceLine, Button, duration, EmptyState, ease, Icon, RareShowcase, SectionTitle, Skeleton, tap, TryOnSheet, useToast } from "@/ui";

// Hierarchy: the Kim bài balance is the hero (gold, big). Below, the three arena outfits as try-on cards.
// The one action is inside the sheet (buy / wear). Buying is safe: online, and both the local wallet and the
// server balance must cover the price (a fresh device never sees purchases made elsewhere).
export function ArenaScreen() {
  const { content, activity, duels } = useServices();
  const toast = useToast();
  const refresh = useRefreshProgress();
  const equipToggle = useEquipToggle();
  const wallet = useAppState((s) => s.wallet);
  const baseLook = useHeroLook();
  const [items, setItems] = useState<ShopItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [trying, setTrying] = useState<ShopItem | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const inFlight = useRef(false);

  const load = useCallback(() => {
    setFailed(false);
    content.getShop().then(setItems, () => setFailed(true));
    if (useAppState.getState().wallet === null) refresh().catch(() => setFailed(true));
  }, [content, refresh]);

  useEffect(() => {
    load();
  }, [load]);

  const arena = (items ?? [])
    .filter((i) => i.currency === "kim_bai" && i.price !== null && fr.shop.items[i.id] !== undefined && characterSlotOf(i) !== null)
    .sort((a, b) => (a.price ?? 0) - (b.price ?? 0));

  function tryOn(item: ShopItem): void {
    if (busy) return;
    setMessage(null);
    setTrying(item);
    setOpen(true);
  }

  // Kim bài purchase: refused (no event) unless online and min(local, server) covers the price.
  async function buy(item: ShopItem): Promise<void> {
    const current = useAppState.getState().wallet;
    if (inFlight.current || busy || item.slot === null || item.price === null || !current) return;
    setMessage(null);
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setMessage(fr.arena.needOnline);
      return;
    }
    inFlight.current = true;
    setBusy(true);
    try {
      let server: number;
      try {
        server = await duels.balance();
      } catch (e) {
        setMessage(e instanceof OfflineError ? fr.arena.needOnline : fr.arena.error);
        return;
      }
      if (Math.min(current.kimBai, server) < item.price) {
        setMessage(current.kimBai >= item.price ? fr.arena.serverBehind : fr.arena.notEnough);
        return;
      }
      const bought = await activity.purchase(item.id);
      if (!bought.ok) {
        await refresh().catch(() => undefined);
        setMessage(fr.arena.error);
        return;
      }
      const worn = await activity.equip(item.slot, item.id).then((r) => r.ok, () => false);
      await refresh().catch(() => undefined);
      toast.show({ title: worn ? fr.arena.bought : fr.shop.tryOn.boughtNotEquipped });
      setOpen(false);
    } catch {
      await refresh().catch(() => undefined);
      setMessage(fr.arena.error);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function toggle(item: ShopItem, equippedNow: boolean): Promise<void> {
    if (busy || item.slot === null) return;
    setBusy(true);
    try {
      if (await equipToggle(item.id, item.slot, equippedNow)) setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: duration.base, ease: ease.out }} className="flex flex-col gap-6 pb-8">
      <motion.div whileTap={tap} className="inline-block self-start">
        <Link to="/duels" aria-label={fr.arena.back} className="flex h-11 w-11 items-center justify-center rounded-full text-ink-muted">
          <Icon name="chevron-left" size={24} />
        </Link>
      </motion.div>
      <h1 className="sr-only">{fr.arena.title}</h1>

      <BalanceLine icon="medal" value={wallet ? fr.arena.balance(wallet.kimBai) : "…"} caption={fr.arena.balanceCaption} />

      <p className="text-body text-ink-muted">{fr.arena.intro}</p>

      {failed ? (
        <EmptyState
          title={fr.arena.title}
          body={fr.arena.loadError}
          illustration="boat"
          action={<Button onClick={load}>{fr.app.error.retry}</Button>}
        />
      ) : items === null || wallet === null ? (
        <Skeleton lines={4} />
      ) : (
        <section aria-labelledby="arena-list" className="flex flex-col gap-3">
          <SectionTitle id="arena-list" overline={fr.ui.overline.arena}>{fr.arena.list}</SectionTitle>
          <RareShowcase entries={rareEntriesOf({ items: arena, wallet, baseLook, busy, onOpen: tryOn, currency: { icon: "medal", label: fr.duels.kimBai } })} />
        </section>
      )}

      {wallet ? (
        <TryOnSheet
          item={trying}
          open={open}
          wallet={wallet}
          baseLook={baseLook}
          busy={busy}
          slot={trying ? characterSlotOf(trying) : null}
          purchaseMessage={message}
          onClose={() => setOpen(false)}
          onBuy={buy}
          onToggle={toggle}
        />
      ) : null}
    </motion.div>
  );
}
