import { Link } from "react-router-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAppState, useRefreshProgress } from "@/app/appState";
import { useServices } from "@/app/ServicesProvider";
import { runGachaPull, useRecoveredPulls } from "@/app/useGachaPulls";
import { OfflineError } from "@/domain/errors";
import type { EnergyState, GachaPull, ShopItem, Wallet } from "@/domain/types";
import { useEquipToggle } from "@/app/useEquipToggle";
import { characterSlotOf } from "@/services/look";
import { gachaCost, isGachaItem, pityFromEvents } from "@/services/gacha";
import { useHeroLook } from "@/app/useHeroLook";
import { fr } from "@/i18n/fr";
import { BalanceLine, Button, Card, ConfirmDialog, EmptyState, SectionTitle, Skeleton, TryOnSheet, useToast } from "@/ui";
import { GachaBanner, type PullCount } from "@/features/shop/GachaBanner";
import { GachaRates } from "@/features/shop/GachaRates";
import { GachaSet } from "@/features/shop/GachaSet";
import { XinXamScene } from "@/features/shop/XinXamScene";

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

function useNavigatorOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);
  return online;
}

// Hierarchy: the balance is the hero (gold, big). Below, the consumables as quiet cards (one action per card), then one
// gacha banner per theme (its x10 pull is the screen's primary action) with the set underneath.
// Only consumables are bought, always through a confirmation; gacha pieces are never sold. Every button is locked
// while a request is running.
export function ShopScreen() {
  const services = useServices();
  const { content, activity, gacha, progress } = services;
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
  const baseLook = useHeroLook();

  const navOnline = useNavigatorOnline();
  const [reachable, setReachable] = useState(true);
  const [serverCoins, setServerCoins] = useState<number | null>(null);
  const [pity, setPity] = useState<Record<string, number>>({});
  const [pulling, setPulling] = useState<PullCount | null>(null);
  // A failure message is only true for the balance and network it was raised with: it carries their key and disappears when they change.
  const [notice, setNotice] = useState<{ text: string; key: string } | null>(null);
  const serverRef = useRef<number | null>(null);
  const reachableRef = useRef(true);
  const [ratesOpen, setRatesOpen] = useState(false);
  const [shown, setShown] = useState<{ pull: GachaPull; recovered: boolean } | null>(null);
  const recoveredPulls = useRecoveredPulls((s) => s.recovered);
  const dismissRecovered = useRecoveredPulls((s) => s.dismiss);

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

  // The server balance (safety net of the pull price check) and whether the server can be reached at all.
  const checkServer = useCallback(async (): Promise<number | null> => {
    try {
      const coins = await gacha.balance();
      serverRef.current = coins;
      reachableRef.current = true;
      setServerCoins(coins);
      setReachable(true);
      return coins;
    } catch (e) {
      if (e instanceof OfflineError) {
        reachableRef.current = false;
        setReachable(false);
      }
      return null;
    }
  }, [gacha]);

  useEffect(() => {
    void checkServer();
  }, [checkServer, navOnline]);

  // Coming back to the app is a chance the server is reachable again (it is also re-checked at every tap).
  useEffect(() => {
    const again = () => {
      if (document.visibilityState !== "hidden") void checkServer();
    };
    window.addEventListener("focus", again);
    document.addEventListener("visibilitychange", again);
    return () => {
      window.removeEventListener("focus", again);
      document.removeEventListener("visibilitychange", again);
    };
  }, [checkServer]);

  // Pity per theme from the journal; each pull's own result then replaces it with the server value.
  const themeIds = items === null ? "" : [...new Set(items.filter(isGachaItem).map((i) => i.theme ?? ""))].join(",");
  const loadPity = useCallback(async () => {
    try {
      const events = await progress.listEvents();
      setPity(Object.fromEntries(themeIds.split(",").filter(Boolean).map((t) => [t, pityFromEvents(events, t)])));
    } catch {
      // the banner just shows the full 40
    }
  }, [progress, themeIds]);

  useEffect(() => {
    void loadPity();
  }, [loadPity]);

  /** The single place a finished pull goes through: the Xin xăm scene (a recovered pull opens on its recap). */
  const presentPull = useCallback((pull: GachaPull, recovered: boolean) => setShown({ pull, recovered }), []);

  // A pull recovered after a crash or a closed app is shown like a fresh one, once.
  useEffect(() => {
    const next = recoveredPulls[0];
    if (!next || shown) return;
    dismissRecovered(next.id);
    presentPull(next, true);
    void refresh().catch(() => undefined);
    void loadPity();
  }, [recoveredPulls, shown, dismissRecovered, presentPull, refresh, loadPity]);

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
    if (busy || pulling !== null) return;
    setTrying(item);
    setTryOpen(true);
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

  const noticeKey = (): string => `${useAppState.getState().wallet?.coins}|${serverRef.current}|${navigator.onLine && reachableRef.current}`;
  const fail = (text: string) => setNotice({ text, key: noticeKey() });

  // One pull: pending events are flushed, then the server balance is checked (min of local and server; this also re-tests a server that was
  // unreachable), then the idempotent pull runs; the server result is mirrored into the journal by `runGachaPull`.
  // Nothing is spent on a refusal. « Il te manque N xu » is never stored: the banner derives it from the balances.
  async function pull(theme: string, count: PullCount): Promise<void> {
    const cost = gachaCost(count);
    if (cost === null || busy || pulling !== null) return;
    setNotice(null);
    setPulling(count);
    try {
      await services.sync.flush().catch(() => undefined); // just-earned xu reach the server before its balance is read
      const server = await checkServer();
      if (server === null) return; // the banner says why (offline)
      const have = Math.min(useAppState.getState().wallet?.coins ?? 0, server);
      if (have < cost) return;
      const res = await runGachaPull(services, theme, count);
      await refresh().catch(() => undefined);
      if (!res.ok) {
        if (res.error === "not_enough") await checkServer(); // the real balance, not a guess
        else fail(fr.gacha.error);
        return;
      }
      serverRef.current = res.coins;
      setServerCoins(res.coins);
      setPity((p) => ({ ...p, [theme]: res.pity }));
      presentPull(res.pull, false);
    } catch (e) {
      if (e instanceof OfflineError) {
        reachableRef.current = false;
        setReachable(false);
        fail(fr.gacha.interrupted);
      } else {
        fail(fr.gacha.error);
      }
    } finally {
      setPulling(null);
    }
  }

  // Arena items (Kim bài) are sold on the Arena screen, never with xu here.
  const known = (items ?? []).filter((i) => fr.shop.items[i.id] !== undefined && i.currency === "xu");
  // Consumables only: reward items (price null, no theme) are earned from badges, gacha pieces from the banners.
  const play = known.filter((i) => i.price !== null && !i.theme);
  const themes: { id: string; items: ShopItem[] }[] = [];
  for (const i of known) {
    if (!isGachaItem(i) || !i.theme || characterSlotOf(i) === null || fr.shop.themes[i.theme] === undefined) continue;
    let group = themes.find((t) => t.id === i.theme);
    if (!group) {
      group = { id: i.theme, items: [] };
      themes.push(group);
    }
    group.items.push(i);
  }
  const asked = asking ? fr.shop.items[asking.id] : undefined;
  const currentKey = `${wallet?.coins}|${serverCoins}|${navOnline && reachable}`;
  const liveNotice = notice !== null && notice.key === currentKey ? notice.text : null;

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

  return (
    <div className="flex flex-col gap-8 pb-8">
      <h1 className="sr-only">{fr.shop.title}</h1>

      <BalanceLine icon="coin" value={wallet ? fr.shop.balance(wallet.coins) : "…"} caption={fr.shop.balanceCaption} />

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
            <SectionTitle id="shop-play" overline={fr.ui.overline.shop}>
              {fr.shop.playTitle}
            </SectionTitle>
            <ul className="flex list-none flex-col gap-3">{play.map((i) => card(i, wallet))}</ul>
          </section>
          {themes.map((t) => (
            <section key={t.id} aria-labelledby={`shop-theme-${t.id}`} className="flex flex-col gap-5">
              <GachaBanner
                theme={t.id}
                items={t.items}
                inventory={wallet.inventory}
                baseLook={baseLook}
                pity={pity[t.id] ?? null}
                localCoins={wallet.coins}
                serverCoins={serverCoins}
                online={navOnline}
                unreachable={!reachable}
                pulling={pulling}
                notice={liveNotice}
                onPull={(count) => void pull(t.id, count)}
                onRates={() => setRatesOpen(true)}
              />
              <div className="flex flex-col gap-3">
                <SectionTitle id={`shop-set-${t.id}`}>{fr.gacha.setTitle}</SectionTitle>
                <GachaSet items={t.items} inventory={wallet.inventory} baseLook={baseLook} busy={busy || pulling !== null} onOpen={tryOn} />
              </div>
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
          slot={trying ? characterSlotOf(trying) : null}
          onClose={() => setTryOpen(false)}
          onToggle={toggleCosmetic}
        />
      ) : null}

      <GachaRates open={ratesOpen} onClose={() => setRatesOpen(false)} />
      <XinXamScene pull={shown?.pull ?? null} recovered={shown?.recovered ?? false} items={items ?? []} baseLook={baseLook} onClose={() => setShown(null)} />

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
