import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { useRefreshProgress, useAppState } from "@/app/appState";
import { useServices } from "@/app/ServicesProvider";
import { fr } from "@/i18n/fr";
import { waitParts } from "@/services/energy";
import { Button, Icon, Sheet, tap } from "@/ui";

const MINUTE_MS = 60_000;

// Hierarchy: the gauge is a quiet header chip (icon + number); the sheet's hero is the five pips, then one line of
// explanation, the next refill, and a single secondary-weight action to review (the way to earn energy back).
export function EnergyIndicator() {
  const energy = useAppState((s) => s.energy);
  const { clock } = useServices();
  const refreshProgress = useRefreshProgress();
  const [open, setOpen] = useState(false);
  const [, setTick] = useState(0);
  const nextAt = energy?.nextAt ?? null;

  // Refresh the state when the next point is due, so the gauge fills without a reload.
  useEffect(() => {
    if (nextAt === null) return;
    const delay = Math.max(1000, Date.parse(nextAt) - Date.parse(clock()));
    const timer = setTimeout(() => void refreshProgress(), delay);
    return () => clearTimeout(timer);
  }, [nextAt, clock, refreshProgress]);

  // Keep the countdown honest while the sheet is open.
  useEffect(() => {
    if (!open) return;
    const timer = setInterval(() => setTick((t) => t + 1), MINUTE_MS);
    return () => clearInterval(timer);
  }, [open]);

  if (energy === null) return null;
  const wait = nextAt === null ? null : waitParts(clock(), nextAt);

  return (
    <>
      <motion.button
        type="button"
        whileTap={tap}
        aria-label={fr.energy.label(energy.current, energy.max)}
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-full"
      >
        <Icon name="bolt" size={20} className={energy.current > 0 ? "text-gold" : "text-ink-muted"} />
        <span className="tabular text-body-strong text-ink" aria-hidden="true">
          {energy.current}
        </span>
      </motion.button>
      <Sheet open={open} onClose={() => setOpen(false)} label={fr.energy.title}>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2" aria-hidden="true">
            {Array.from({ length: energy.max }, (_, i) => (
              <Icon key={i} name="bolt" size={32} className={i < energy.current ? "fill-gold text-gold" : "fill-surface-2 text-line"} />
            ))}
          </div>
          <p className="text-body text-ink-muted">{fr.energy.explain}</p>
          <p className="text-body-strong text-ink">{wait ? fr.energy.next(wait.hours, wait.minutes) : fr.energy.full}</p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Link
              to="/review"
              onClick={() => setOpen(false)}
              className="inline-flex min-h-11 items-center justify-center rounded-md border-2 border-line bg-surface px-5 py-3 text-body-strong text-ink"
            >
              {fr.energy.review}
            </Link>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {fr.energy.close}
            </Button>
          </div>
        </div>
      </Sheet>
    </>
  );
}
