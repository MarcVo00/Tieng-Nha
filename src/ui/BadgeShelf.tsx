import { useId, useState } from "react";
import { motion } from "motion/react";
import { fr } from "@/i18n/fr";
import { BadgeMedal } from "@/ui/BadgeMedal";
import { Icon } from "@/ui/icons";
import { tap } from "@/ui/motion";

type Shelf = { id: string; icon: string; title: string };

type BadgeShelfProps = {
  badges: readonly Shelf[];
  unlocked: ReadonlySet<string>;
  /** Makes every medal a button (own profile: opens its detail sheet). Without it the shelf is read-only. */
  onSelect?: (badge: Shelf) => void;
  /** Shown when nothing is earned yet. */
  none?: string;
};

// Hierarchy: the earned medals are the shelf; the locked ones are empty inlays folded behind « +N à découvrir ».
export function BadgeShelf({ badges, unlocked, onSelect, none = fr.ui.badge.none }: BadgeShelfProps) {
  const [open, setOpen] = useState(false);
  const panel = useId();
  const earned = badges.filter((b) => unlocked.has(b.id));
  const locked = badges.filter((b) => !unlocked.has(b.id));

  const cell = (b: Shelf) => (
    <li key={b.id} className="flex justify-center">
      {onSelect ? (
        <motion.button type="button" whileTap={tap} onClick={() => onSelect(b)} className="min-h-11 rounded-md p-1">
          <BadgeMedal icon={b.icon} title={b.title} unlocked={unlocked.has(b.id)} />
        </motion.button>
      ) : (
        <BadgeMedal icon={b.icon} title={b.title} unlocked={unlocked.has(b.id)} />
      )}
    </li>
  );

  return (
    <div className="mt-3 flex flex-col gap-4">
      {earned.length > 0 ? <ul className="grid list-none grid-cols-3 gap-4 pb-2">{earned.map(cell)}</ul> : <p className="text-body text-ink-muted">{none}</p>}
      {locked.length > 0 ? (
        <>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={open ? panel : undefined}
            onClick={() => setOpen((v) => !v)}
            className="flex min-h-11 items-center justify-center gap-1.5 rounded-md border-2 border-dashed border-gold-ink text-body-strong text-gold-ink"
          >
            {fr.ui.badge.more(locked.length)}
            <Icon name={open ? "chevron-up" : "chevron-down"} size={18} />
          </button>
          {open ? (
            <div id={panel}>
              <ul className="grid list-none grid-cols-3 gap-4">{locked.map(cell)}</ul>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
