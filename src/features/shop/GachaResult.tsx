import type { GachaPull } from "@/domain/types";
import { fr } from "@/i18n/fr";
import { Button, RarityBadge, Sheet } from "@/ui";

type Props = {
  /** The pull to show, null when closed. The Xin xam scene (next task) replaces this plain list behind the same prop. */
  pull: GachaPull | null;
  /** True when the pull comes from the recovery instead of a tap. */
  recovered?: boolean;
  onClose: () => void;
};

// Hierarchy: what you got, in draw order; the refund total is the only summary; one action.
export function GachaResult({ pull, recovered = false, onClose }: Props) {
  const refunds = pull ? pull.items.reduce((sum, i) => sum + i.refund, 0) : 0;
  return (
    <Sheet open={pull !== null} onClose={onClose} label={pull ? fr.gacha.resultLabel(pull.cost) : fr.gacha.resultTitle}>
      {pull ? (
        <div className="flex flex-col gap-4">
          <h2 className="text-heading text-ink">{recovered ? fr.gacha.recovered : fr.gacha.resultTitle}</h2>
          <ul className="flex max-h-[50vh] list-none flex-col divide-y divide-line overflow-y-auto">
            {pull.items.map((it, i) => (
              <li key={`${it.itemId}-${i}`} className="flex items-center justify-between gap-3 py-2.5">
                <div className="flex min-w-0 flex-col">
                  <span className="text-body-strong text-ink">{fr.shop.items[it.itemId]?.name ?? it.itemId}</span>
                  <RarityBadge rarity={it.rarity} />
                </div>
                <span className={`tabular shrink-0 text-caption ${it.duplicate ? "text-ink-muted" : "text-gold-ink"}`}>
                  {it.duplicate ? fr.gacha.resultDuplicate(it.refund) : fr.gacha.resultNew}
                </span>
              </li>
            ))}
          </ul>
          {refunds > 0 ? <p className="tabular text-caption text-ink-muted">{fr.gacha.resultTotal(refunds)}</p> : null}
          <Button fullWidth autoFocus onClick={onClose}>
            {fr.gacha.resultContinue}
          </Button>
        </div>
      ) : null}
    </Sheet>
  );
}
