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
  /** Pity counter of the player for this theme. */
  pity: number;
  /** The amount the pull buttons are checked against (min of the local journal and the server when known). */
  coins: number;
  online: boolean;
  /** The pull being run, null when idle. */
  pulling: PullCount | null;
  /** Why the last attempt did not go through (announced politely). */
  notice: string | null;
  onPull: (count: PullCount) => void;
  onRates: () => void;
};

// Hierarchy: the legendary piece of the set is the art; the x10 pull is the one primary action, the single pull and
// the rates stay quiet. The banner sits on the forced lacquer surface (like the rare showcase) with a gold fillet.
export function GachaBanner({ theme, items, inventory, baseLook, pity, coins, online, pulling, notice, onPull, onRates }: Props) {
  const total = items.length;
  const owned = items.filter((i) => inventory.includes(i.id)).length;
  const complete = total > 0 && owned === total;
  const art = items.find((i) => i.rarity === "legendary") ?? items[0];
  const artSlot = art ? characterSlotOf(art) : null;
  const look: Look = art && artSlot ? { ...baseLook, [artSlot]: art.id } : baseLook;
  const busy = pulling !== null;

  const one = GACHA.costs[1];
  const ten = GACHA.costs[10];
  const reason = !online ? fr.gacha.offline : coins < one ? fr.gacha.missing(one - coins) : coins < ten ? fr.gacha.missing(ten - coins) : null;
  const disabled = (cost: number) => busy || !online || coins < cost;
  const remaining = Math.max(GACHA.pityAt - pity, 1);

  return (
    <div data-theme="dark" data-banner={theme} className="relative rounded-md bg-surface p-5 text-ink shadow-raised">
      <span aria-hidden="true" className="pointer-events-none absolute inset-1.5 rounded-sm border border-gold opacity-60" />
      <div className="flex items-center gap-4">
        <HeroMedallion look={look} size={112} ring={owned > 0 ? "gold" : "neutral"} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span lang="vi" aria-hidden="true" className="text-caption font-semibold uppercase tracking-[0.18em] text-gold-ink">
            {fr.gacha.overline}
          </span>
          <h2 id={`shop-theme-${theme}`} className="text-heading text-ink">
            {fr.shop.themes[theme] ?? theme}
          </h2>
          <p className="tabular text-body-strong text-ink">{fr.gacha.ownedCount(owned, total)}</p>
          {complete ? (
            <p className="text-caption text-gold-ink">
              <strong className="font-semibold">{fr.gacha.complete}</strong> {fr.gacha.completeHint}
            </p>
          ) : null}
          <p className="tabular text-caption text-ink-muted">{fr.gacha.pityLine(remaining)}</p>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3">
        <Button fullWidth loading={pulling === 10} disabled={disabled(ten)} aria-describedby="gacha-reason" onClick={() => onPull(10)}>
          {fr.gacha.pullTen(ten)}
        </Button>
        <Button variant="secondary" fullWidth loading={pulling === 1} disabled={disabled(one)} aria-describedby="gacha-reason" onClick={() => onPull(1)}>
          {fr.gacha.pullOne(one)}
        </Button>
        <p id="gacha-reason" role="status" className="min-h-5 text-caption text-ink-muted">
          {notice ?? reason}
        </p>
        <button type="button" onClick={onRates} className="inline-flex min-h-11 items-center self-start text-body-strong text-primary underline">
          {fr.gacha.rates}
        </button>
      </div>
    </div>
  );
}
