import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { useRefreshProgress, useAppState } from "@/app/appState";
import { useServices } from "@/app/ServicesProvider";
import { useCountdown } from "@/app/useCountdown";
import { fr } from "@/i18n/fr";
import { formatCountdown, msUntilFull, waitParts } from "@/services/energy";
import { Button, ConfirmDialog, Icon, Sheet, tap, useToast } from "@/ui";

// Hierarchy: the gauge is a quiet header chip (icon + number); the sheet's hero is the five pips, then one line of
// explanation, the next refill, and a single secondary-weight action to review (the way to earn energy back).
export function EnergyIndicator() {
  const energy = useAppState((s) => s.energy);
  const dueCount = useAppState((s) => s.dueCount);
  const refreshProgress = useRefreshProgress();
  const { clock, content, activity } = useServices();
  const toast = useToast();
  const coins = useAppState((s) => s.wallet?.coins ?? null);
  const [refillPrice, setRefillPrice] = useState<number | null>(null);
  const [asking, setAsking] = useState(false);
  const [buying, setBuying] = useState(false);
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const nextAt = energy?.nextAt ?? null;
  const remaining = useCountdown(nextAt);

  // Refresh the state when the next point is due, so the gauge fills without a reload.
  useEffect(() => {
    if (nextAt === null) return;
    const delay = Math.max(1000, Date.parse(nextAt) - Date.parse(clock()));
    const timer = setTimeout(() => void refreshProgress().catch(() => undefined), delay);
    return () => clearTimeout(timer);
  }, [nextAt, clock, refreshProgress]);

  // The price comes from the catalogue, read once when the sheet first opens.
  useEffect(() => {
    if (!open || refillPrice !== null) return;
    let cancelled = false;
    content
      .getShop()
      .then((shop) => {
        const price = shop.find((i) => i.id === "energy_refill")?.price;
        if (!cancelled && typeof price === "number") setRefillPrice(price);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [open, refillPrice, content]);

  async function refill(): Promise<void> {
    if (buying) return;
    setBuying(true);
    try {
      const r = await activity.purchase("energy_refill");
      await refreshProgress().catch(() => undefined);
      toast.show({ title: r.ok ? fr.shop.bought : fr.shop.error });
    } catch {
      toast.show({ title: fr.shop.error });
    } finally {
      setBuying(false);
      closeAsk();
    }
  }

  // Only one modal at a time: the sheet is closed before the confirmation opens, and focus returns to the gauge.
  function closeAsk(): void {
    setAsking(false);
    triggerRef.current?.focus();
  }

  if (energy === null) return null;
  const wait = remaining === null ? null : waitParts(remaining);
  const fullIn = remaining === null ? null : msUntilFull(remaining, energy);

  const canRefill = energy.current < energy.max && refillPrice !== null && coins !== null && coins >= refillPrice;

  return (
    <>
      <motion.button
        ref={triggerRef}
        type="button"
        whileTap={tap}
        aria-label={wait ? fr.energy.labelWithWait(energy.current, energy.max, wait.hours, wait.minutes) : fr.energy.label(energy.current, energy.max)}
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-full"
      >
        <Icon name="bolt" size={20} className={energy.current > 0 ? "text-gold" : "text-ink-muted"} />
        <span className="tabular text-body-strong text-ink" aria-hidden="true">
          {energy.current}
        </span>
        {remaining !== null ? (
          <span className="tabular hidden text-caption text-ink-muted min-[360px]:inline" aria-hidden="true">
            {formatCountdown(remaining)}
          </span>
        ) : null}
      </motion.button>
      <Sheet open={open} onClose={() => setOpen(false)} label={fr.energy.title}>
        <div className="flex flex-col gap-4">
          <p className="sr-only">{fr.energy.label(energy.current, energy.max)}</p>
          <div className="flex items-center gap-2" aria-hidden="true">
            {Array.from({ length: energy.max }, (_, i) => (
              <Icon key={i} name="bolt" size={32} className={i < energy.current ? "fill-gold text-gold" : "fill-surface-2 text-line"} />
            ))}
          </div>
          <p className="text-body text-ink-muted">{fr.energy.explain}</p>
          {remaining !== null && fullIn !== null ? (
            <div className="flex flex-col gap-1">
              <p className="tabular text-heading text-ink">{fr.energy.nextIn(formatCountdown(remaining))}</p>
              {fullIn > remaining ? <p className="tabular text-body text-ink-muted">{fr.energy.fullIn(formatCountdown(fullIn))}</p> : null}
            </div>
          ) : (
            <p className="text-body-strong text-ink">{fr.energy.full}</p>
          )}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            {dueCount > 0 ? (
              <Link
                to="/review"
                onClick={() => setOpen(false)}
                className="inline-flex min-h-11 items-center justify-center rounded-md border-2 border-line bg-surface px-5 py-3 text-body-strong text-ink"
              >
                {fr.energy.review}
              </Link>
            ) : null}
            {canRefill ? (
              <Button variant="secondary" disabled={buying} onClick={() => {
                setOpen(false);
                setAsking(true);
              }}>
                <Icon name="coin" size={20} className="text-gold" />
                {fr.shop.refill(refillPrice ?? 0)}
              </Button>
            ) : null}
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {fr.energy.close}
            </Button>
          </div>
        </div>
      </Sheet>
      <ConfirmDialog
        open={asking && refillPrice !== null}
        title={fr.shop.confirm.title(fr.shop.items["energy_refill"]?.confirmName ?? "", refillPrice ?? 0)}
        confirmLabel={fr.shop.confirm.confirm}
        cancelLabel={fr.shop.confirm.cancel}
        busy={buying}
        onConfirm={() => void refill()}
        onCancel={() => !buying && closeAsk()}
      />
    </>
  );
}
