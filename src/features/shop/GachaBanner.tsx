import type { Look, ShopItem } from "@/domain/types";
import { fr } from "@/i18n/fr";
import { GACHA } from "@/services/gacha";
import { characterSlotOf } from "@/services/look";
import { Button, HeroMedallion } from "@/ui";

export type PullCount = 1 | 10;

type Props = {
  theme: string;
  /** Every gacha item of the theme. */
  items: readonly ShopItem[];
  inventory: readonly string[];
  baseLook: Look;
  /** Overrides the art (by default the theme's legendary on the base look), e.g. a character holding its accessory. */
  artLook?: Partial<Look>;
  /** Pity counter of the player for this theme, null until the journal has been read (nothing is shown meanwhile). */
  pity: number | null;
  /** Xu of the local journal and of the server (null until known): pulls are checked against the smaller one. */
  localCoins: number;
  serverCoins: number | null;
  /** False when the device has no network: the pulls are disabled. An unreachable server only warns (the tap re-checks it). */
  online: boolean;
  /** The server did not answer last time. */
  unreachable: boolean;
  /** The pull being run, null when idle. */
  pulling: PullCount | null;
  /** Why the last attempt did not go through (announced politely). */
  notice: string | null;
  onPull: (count: PullCount) => void;
  onRates: () => void;
};

// Hierarchy: the legendary piece of the set is the art; the x10 pull is the one primary action, the single pull and
// the rates stay quiet. The banner sits on the forced lacquer surface (like the rare showcase) with a gold fillet.
export function GachaBanner({ theme, items, inventory, baseLook, artLook, pity, localCoins, serverCoins, online, unreachable, pulling, notice, onPull, onRates }: Props) {
  const total = items.length;
  const owned = items.filter((i) => inventory.includes(i.id)).length;
  const complete = total > 0 && owned === total;
  const art = items.find((i) => i.rarity === "legendary") ?? items[0];
  const artSlot = art ? characterSlotOf(art) : null;
  const look: Look = artLook ? { ...baseLook, ...artLook } : art && artSlot ? { ...baseLook, [artSlot]: art.id } : baseLook;
  const title = fr.gacha.bannerTitles[theme];
  const busy = pulling !== null;

  const one = GACHA.costs[1];
  const ten = GACHA.costs[10];
  const coins = serverCoins === null ? localCoins : Math.min(localCoins, serverCoins);
  // The server balance is the limiting one: the local journal is ahead of it (a pull or a sync is still on its way).
  const serverLimits = serverCoins !== null && serverCoins < localCoins;
  const reasonFor = (cost: number): string | null =>
    !online || unreachable ? fr.gacha.offline : coins >= cost ? null : serverLimits ? fr.gacha.syncing : fr.gacha.missing(cost - coins);
  const reasonOne = reasonFor(one);
  const reasonTen = reasonFor(ten);
  const disabled = (cost: number) => busy || !online || coins < cost;
  const remaining = pity === null ? null : Math.max(GACHA.pityAt - pity, 1);
  // Gold is a reward: the fillet and the overline turn gold once the set has a piece, until then they stay neutral.
  const earned = owned > 0;
  const idOne = `gacha-reason-one-${theme}`;
  const idTen = `gacha-reason-ten-${theme}`;
  const idNotice = `gacha-notice-${theme}`;
  const describe = (id: string) => (notice ? `${id} ${idNotice}` : id);

  return (
    <div data-theme="dark" data-banner={theme} className="relative rounded-md bg-surface p-5 text-ink shadow-raised">
      <span aria-hidden="true" className={`pointer-events-none absolute inset-1.5 rounded-sm border opacity-60 ${earned ? "border-gold" : "border-line"}`} />
      <div className="flex items-center gap-4">
        <HeroMedallion look={look} size={112} ring={owned > 0 ? "gold" : "neutral"} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span lang="vi" aria-hidden="true" className={`text-caption font-semibold uppercase tracking-[0.18em] ${earned ? "text-gold-ink" : "text-ink-muted"}`}>
            {fr.gacha.overline}
          </span>
          <h2 id={`shop-theme-${theme}`} className="text-heading text-ink">
            {title ? (
              <>
                <span lang="vi">{title.vi}</span> — {title.fr}
              </>
            ) : (
              (fr.shop.themes[theme] ?? theme)
            )}
          </h2>
          <p className="tabular text-body-strong text-ink">{fr.gacha.ownedCount(owned, total)}</p>
          {complete ? (
            <p className="text-caption text-gold-ink">
              <strong className="font-semibold">{fr.gacha.complete}</strong> {fr.gacha.completeHint}
            </p>
          ) : null}
          {remaining === null ? null : <p className="tabular text-caption text-ink-muted">{fr.gacha.pityLine(remaining)}</p>}
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <Button fullWidth loading={pulling === 10} disabled={disabled(ten)} aria-describedby={describe(idTen)} onClick={() => onPull(10)}>
            {fr.gacha.pullTen(ten)}
          </Button>
          <p id={idTen} className="min-h-5 text-caption text-ink-muted">
            {reasonTen}
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <Button variant="secondary" fullWidth loading={pulling === 1} disabled={disabled(one)} aria-describedby={describe(idOne)} onClick={() => onPull(1)}>
            {fr.gacha.pullOne(one)}
          </Button>
          <p id={idOne} className="min-h-5 text-caption text-ink-muted">
            {reasonOne}
          </p>
        </div>
        <p id={idNotice} role="status" className="text-caption text-ink">
          {notice}
        </p>
        <button type="button" onClick={onRates} className="inline-flex min-h-11 items-center self-start text-body-strong text-primary underline">
          {fr.gacha.rates}
        </button>
      </div>
    </div>
  );
}
