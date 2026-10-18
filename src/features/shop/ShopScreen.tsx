import { Link } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { useAppState, useRefreshProgress } from "@/app/appState";
import { useServices } from "@/app/ServicesProvider";
import type { EnergyState, ShopItem, Wallet } from "@/domain/types";
import { useEquipToggle } from "@/app/useEquipToggle";
import { characterSlotOf, lookOf } from "@/services/look";
import { fr } from "@/i18n/fr";
import { Button, Card, ConfirmDialog, EmptyState, HeroMedallion, Icon, Skeleton, tap, useToast } from "@/ui";
import { TryOnSheet } from "@/features/shop/TryOnSheet";

type Verdict = { label: string; disabled: boolean; action: "buy" | "none" };

function verdictOf(item: ShopItem, wallet: Wallet, energy: EnergyState | null): Verdict {
  if (item.id === "streak_freeze" && item.maxStock !== undefined && wallet.freezes >= item.maxStock) {
    return { label: fr.shop.stockFull, disabled: true, action: "none" };
  }
  if (item.id === "energy_refill") {
    if (energy === null) return { label: item.price === null ? fr.shop.noFunds : fr.shop.buy(item.price), disabled: true, action: "none" };
    if (energy.current >= energy.max) return { label: fr.shop.energyFull, disabled: true, action: "none" };
  }
  if (item.price === null) return { label: fr.shop.noFunds, disabled: true, action: "none" };
  if (wallet.coins < item.price) return { label: fr.shop.noFunds, disabled: true, action: "none" };
  return { label: fr.shop.buy(item.price), disabled: false, action: "buy" };
}

// Hierarchy: the balance is the hero (gold, big). Below, two quiet sections of cards, one action per card.
// Buying always goes through a confirmation; every button is locked while a request is running.
export function ShopScreen() {
  const { content, activity } = useServices();
  const toast = useToast();
  const refresh = useRefreshProgress();
  const wallet = useAppState((s) => s.wallet);
  const energy = useAppState((s) => s.energy);
  const [items, setItems] = useState<ShopItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [asking, setAsking] = useState<ShopItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [walletFailed, setWalletFailed] = useState(false);
  const equipToggle = useEquipToggle();
  const [trying, setTrying] = useState<ShopItem | null>(null);
  const [tryOpen, setTryOpen] = useState(false);
  const equipped = useAppState((s) => s.wallet?.equipped);
  const baseLook = useMemo(() => lookOf(equipped ?? {}), [equipped]);

  useEffect(() => {
    let cancelled = false;
    content
      .getShop()
      .then((s) => !cancelled && setItems(s))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [content]);

  const loadWallet = useCallback(() => {
    setWalletFailed(false);
    refresh().catch(() => setWalletFailed(true));
  }, [refresh]);

  useEffect(() => {
    if (useAppState.getState().wallet === null) loadWallet();
  }, [loadWallet]);

  function retry(): void {
    setFailed(false);
    content
      .getShop()
      .then(setItems)
      .catch(() => setFailed(true));
    loadWallet();
  }

  async function run(job: () => Promise<{ ok: boolean }>, success: string, failure: string = fr.shop.error): Promise<void> {
    setBusy(true);
    try {
      const r = await job();
      await refresh().catch(() => undefined);
      toast.show({ title: r.ok ? success : failure });
    } catch {
      toast.show({ title: failure });
    } finally {
      setBusy(false);
      setAsking(null);
    }
  }

  function onAction(item: ShopItem, v: Verdict): void {
    if (busy) return;
    if (v.action === "buy") setAsking(item);
  }

  function tryOn(item: ShopItem): void {
    if (busy) return;
    setTrying(item);
    setTryOpen(true);
  }

  // Buy, then wear it at once: two events. A failed equip still leaves the item owned.
  async function buyCosmetic(item: ShopItem): Promise<void> {
    if (busy || item.slot === null) return;
    setBusy(true);
    try {
      const bought = await activity.purchase(item.id);
      if (!bought.ok) {
        await refresh().catch(() => undefined);
        toast.show({ title: fr.shop.error });
        return;
      }
      const worn = await activity.equip(item.slot, item.id).then((r) => r.ok, () => false);
      await refresh().catch(() => undefined);
      toast.show({ title: worn ? fr.shop.bought : fr.shop.tryOn.boughtNotEquipped });
      setTryOpen(false);
    } catch {
      await refresh().catch(() => undefined);
      toast.show({ title: fr.shop.error });
    } finally {
      setBusy(false);
    }
  }

  async function toggleCosmetic(item: ShopItem, equippedNow: boolean): Promise<void> {
    if (busy || item.slot === null) return;
    setBusy(true);
    try {
      if (await equipToggle(item.id, item.slot, equippedNow)) setTryOpen(false);
    } finally {
      setBusy(false);
    }
  }

  const known = (items ?? []).filter((i) => fr.shop.items[i.id] !== undefined);
  // Reward items (price null) are earned from badges, never sold.
  const play = known.filter((i) => i.price !== null && !i.theme);
  const themes: { id: string; items: ShopItem[] }[] = [];
  for (const i of known) {
    if (!i.theme || i.slot === null || i.price === null || fr.shop.themes[i.theme] === undefined) continue;
    let group = themes.find((t) => t.id === i.theme);
    if (!group) {
      group = { id: i.theme, items: [] };
      themes.push(group);
    }
    group.items.push(i);
  }
  for (const t of themes) t.items.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
  const asked = asking ? fr.shop.items[asking.id] : undefined;

  function card(item: ShopItem, w: Wallet) {
    const text = fr.shop.items[item.id];
    if (!text) return null;
    const v = verdictOf(item, w, energy);
    return (
      <Card as="li" key={item.id} className="flex items-center gap-4 p-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-body-strong text-ink">{text.name}</h3>
          <p className="text-caption text-ink-muted">{text.desc}</p>
          {item.id === "streak_freeze" && item.maxStock !== undefined ? (
            <p className="tabular text-caption text-ink-muted">{fr.shop.stock(w.freezes, item.maxStock)}</p>
          ) : null}
        </div>
        <Button
          variant="secondary"
          disabled={v.disabled || busy}
          onClick={() => onAction(item, v)}
          className="shrink-0"
        >
          {v.label}
        </Button>
      </Card>
    );
  }

  function themedCard(item: ShopItem, w: Wallet) {
    const text = fr.shop.items[item.id];
    const slot = characterSlotOf(item);
    if (!text || slot === null) return null;
    const owned = w.inventory.includes(item.id);
    const on = w.equipped[slot] === item.id;
    return (
      <li key={item.id}>
        <motion.button
          type="button"
          whileTap={tap}
          disabled={busy}
          aria-label={fr.shop.tryOn.open(text.name)}
          onClick={() => tryOn(item)}
          className="flex h-full w-full flex-col items-center gap-2 rounded-md bg-surface p-3 text-center shadow-card disabled:opacity-60"
        >
          <HeroMedallion look={{ ...baseLook, [slot]: item.id }} size={112} />
          <span className="text-body-strong text-ink">{text.name}</span>
          {owned ? (
            <span className={`text-caption ${on ? "text-gold-ink" : "text-ink-muted"}`}>{on ? fr.shop.tryOn.equipped : fr.shop.tryOn.owned}</span>
          ) : (
            <span className="tabular inline-flex items-center gap-1 text-caption text-gold-ink">
              <Icon name="coin" size={16} className="text-gold" />
              {fr.shop.balance(item.price ?? 0)}
            </span>
          )}
        </motion.button>
      </li>
    );
  }

  return (
    <div className="flex flex-col gap-8 pb-8">
      <h1 className="sr-only">{fr.shop.title}</h1>

      <Card raised className="flex items-center gap-4 p-6">
        <Icon name="coin" size={48} className="shrink-0 text-gold" />
        <div>
          <p className="tabular text-display text-gold-ink">{wallet ? fr.shop.balance(wallet.coins) : "…"}</p>
          <p className="text-caption text-ink-muted">{fr.shop.balanceCaption}</p>
        </div>
      </Card>

      {failed || walletFailed ? (
        <EmptyState
          title={fr.shop.title}
          body={fr.shop.loadError}
          illustration="boat"
          action={<Button onClick={retry}>{fr.app.error.retry}</Button>}
        />
      ) : items === null || wallet === null ? (
        <Skeleton lines={4} />
      ) : (
        <>
          <section aria-labelledby="shop-play" className="flex flex-col gap-3">
            <h2 id="shop-play" className="text-heading text-ink">
              {fr.shop.playTitle}
            </h2>
            <ul className="flex list-none flex-col gap-3">{play.map((i) => card(i, wallet))}</ul>
          </section>
          {themes.map((t) => (
            <section key={t.id} aria-labelledby={`shop-theme-${t.id}`} className="flex flex-col gap-3">
              <h2 id={`shop-theme-${t.id}`} className="text-heading text-ink">
                {fr.shop.themes[t.id]}
              </h2>
              <ul className="grid list-none grid-cols-2 gap-3">{t.items.map((i) => themedCard(i, wallet))}</ul>
            </section>
          ))}
          <p className="text-caption text-ink-muted">
            {fr.rewards.hint}{" "}
            <Link to="/me#me-rewards" className="inline-flex min-h-11 items-center text-body-strong text-primary underline">
              {fr.rewards.shopLink}
            </Link>
          </p>
        </>
      )}

      {wallet ? (
        <TryOnSheet
          item={trying}
          open={tryOpen}
          wallet={wallet}
          baseLook={baseLook}
          busy={busy}
          onClose={() => setTryOpen(false)}
          onBuy={buyCosmetic}
          onToggle={toggleCosmetic}
        />
      ) : null}

      <ConfirmDialog
        open={asking !== null}
        title={asking && asked && asking.price !== null ? fr.shop.confirm.title(asked.confirmName, asking.price) : ""}
        confirmLabel={fr.shop.confirm.confirm}
        cancelLabel={fr.shop.confirm.cancel}
        busy={busy}
        onConfirm={() => asking && void run(() => activity.purchase(asking.id), fr.shop.bought)}
        onCancel={() => !busy && setAsking(null)}
      />
    </div>
  );
}
