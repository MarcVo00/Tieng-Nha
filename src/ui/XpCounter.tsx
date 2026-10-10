import { useEffect } from "react";
import { animate, AnimatePresence, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { fr } from "@/i18n/fr";
import { duration } from "@/ui/motion";

type XpCounterProps = { value: number; delta?: number };

export function XpCounter({ value, delta }: XpCounterProps) {
  const mv = useMotionValue(value);
  const rounded = useTransform(mv, (v) => Math.round(v));
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) {
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, { duration: 0.6 });
    return () => controls.stop();
  }, [mv, value, reduced]);

  return (
    <span className="relative inline-flex items-baseline gap-1 text-heading text-gold-ink">
      <span className="sr-only">{fr.ui.xp.label(value)}</span>
      <motion.span className="tabular" aria-hidden="true">
        {rounded}
      </motion.span>
      <span className="text-caption" aria-hidden="true">
        {fr.ui.xp.unit}
      </span>
      <AnimatePresence>
        {delta ? (
          <motion.span
            key={`${value}-${delta}`}
            aria-hidden="true"
            className="tabular pointer-events-none absolute -top-1 right-0 text-body-strong text-gold-ink"
            initial={{ opacity: 1, y: 0 }}
            animate={{ opacity: 0, y: -24 }}
            exit={{ opacity: 0 }}
            transition={{ duration: duration.celebrate }}
          >
            {`+${delta}`}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </span>
  );
}
