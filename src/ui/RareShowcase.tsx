import type { ReactNode } from "react";
import { motion } from "motion/react";
import type { Look } from "@/domain/types";
import { fr } from "@/i18n/fr";
import { HeroMedallion } from "@/ui/HeroMedallion";
import { tap } from "@/ui/motion";

export type RareEntry = {
  id: string;
  look: Look;
  name: string;
  desc: string;
  /** Owned items get the gold ring on the medallion. */
  owned: boolean;
  /** Price or ownership line, already rendered. */
  status: ReactNode;
  disabled: boolean;
  onOpen: () => void;
};

function Seal({ className }: { className: string }) {
  return (
    <span aria-hidden="true" lang="vi" className={`absolute rotate-[4deg] rounded-[3px] bg-fx-vermilion px-1.5 py-0.5 text-caption font-semibold text-paper ${className}`}>
      {fr.ui.rare}
    </span>
  );
}

// Hierarchy: the first piece is the showcase (large, centred); the others are quieter rows. Rare items sit on a
// forced lacquer surface (data-theme="dark") with an inner gold fillet and a vermilion « Hiếm » seal, in both app themes.
function RareCard({ entry, featured }: { entry: RareEntry; featured: boolean }) {
  return (
    <li data-theme="dark" data-rare={featured ? "featured" : "row"} className="relative rounded-md bg-surface text-ink shadow-raised">
      <motion.button
        type="button"
        whileTap={tap}
        disabled={entry.disabled}
        onClick={entry.onOpen}
        className={`relative flex w-full rounded-md disabled:opacity-60 ${featured ? "flex-col items-center gap-3 p-6 pt-8 text-center" : "items-center gap-4 p-4 pr-16 text-left"}`}
      >
        <HeroMedallion look={entry.look} size={featured ? 160 : 72} ring={entry.owned ? "gold" : "neutral"} />
        <span className="flex min-w-0 flex-col gap-1">
          <h3 className={featured ? "text-heading text-ink" : "text-body-strong text-ink"}>
            <span className="sr-only">{fr.shop.tryOn.prefix} </span>
            {entry.name}
          </h3>
          {featured ? <span className="mx-auto max-w-xs text-caption text-ink-muted">{entry.desc}</span> : null}
          {entry.status}
        </span>
      </motion.button>
      <span aria-hidden="true" className="pointer-events-none absolute inset-1.5 rounded-sm border border-gold opacity-60" />
      <Seal className={featured ? "right-4 top-4" : "right-4 top-1/2 -mt-3"} />
    </li>
  );
}

export function RareShowcase({ entries }: { entries: readonly RareEntry[] }) {
  return (
    <ul className="flex list-none flex-col gap-3">
      {entries.map((e, i) => (
        <RareCard key={e.id} entry={e} featured={i === 0} />
      ))}
    </ul>
  );
}
