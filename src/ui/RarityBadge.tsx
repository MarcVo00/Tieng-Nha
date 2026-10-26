import type { Rarity } from "@/domain/types";
import { fr } from "@/i18n/fr";

// The stick/seal colour of each rarity: light wood, jade, vermilion lacquer, gold (gold = the legendary reward).
// The word always carries the meaning; the colour is a little lacquered stick beside it.
const STICK: Record<Rarity, string> = {
  common: "bg-frame-bronze",
  rare: "bg-frame-jade",
  epic: "bg-fx-vermilion",
  legendary: "bg-gold",
};

export function RarityBadge({ rarity, className }: { rarity: Rarity; className?: string }) {
  return (
    <span data-rarity={rarity} className={`inline-flex items-center gap-1.5 text-caption font-semibold text-ink ${className ?? ""}`}>
      <span aria-hidden="true" className={`h-3 w-1.5 shrink-0 rounded-full ${STICK[rarity]}`} />
      {fr.shop.rarities[rarity]}
    </span>
  );
}
