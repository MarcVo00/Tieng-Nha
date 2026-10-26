import { fr } from "@/i18n/fr";
import { GACHA, gachaRates } from "@/services/gacha";
import { Button, RarityBadge, Sheet } from "@/ui";

// Hierarchy: the four rates are the content; the guarantees are the small print; one quiet close button.
export function GachaRates({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} label={fr.gacha.ratesTitle}>
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-heading text-ink">{fr.gacha.ratesTitle}</h2>
          <p className="mt-1 text-body text-ink-muted">{fr.gacha.ratesIntro}</p>
        </div>
        <ul className="flex list-none flex-col divide-y divide-line">
          {gachaRates().map((r) => (
            <li key={r.rarity} className="flex items-center justify-between gap-3 py-3">
              <div className="flex flex-col">
                <RarityBadge rarity={r.rarity} />
                <span className="tabular text-caption text-ink-muted">{fr.gacha.refund(r.refund)}</span>
              </div>
              <span className="tabular text-heading text-ink">{fr.gacha.ratePercent(r.percent)}</span>
            </li>
          ))}
        </ul>
        <p className="text-caption text-ink-muted">{fr.gacha.pityRule(GACHA.pityAt)}</p>
        <p className="text-caption text-ink-muted">{fr.gacha.tenRule}</p>
        <Button variant="secondary" fullWidth autoFocus onClick={onClose}>
          {fr.gacha.close}
        </Button>
      </div>
    </Sheet>
  );
}
