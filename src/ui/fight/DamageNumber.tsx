import { motion } from "motion/react";
import { ease, spring } from "@/ui/motion";
import { FIGHT, type Tempo } from "@/ui/fight/fightTiming";
import { useFxReduced } from "@/ui/fight/InkImpact";

type DamageNumberProps = {
  value: number;
  critical: boolean;
  tempo?: Tempo;
  /** Seconds until the caller unmounts it (at most `FIGHT.number / tempo`): it has faded out by then. */
  life?: number;
  /** Fade only: no pop, no rise. Defaults to the user's reduced-motion setting. */
  reduced?: boolean;
};

/**
 * Floating damage, stamped on contact: `scale 1.4 → 1` (bouncy), then it rises 24 px and fades. A static paper outline
 * keeps it readable over the ink and the dark theme. Decorative: the blow is announced by the caller's live region.
 */
export function DamageNumber({ value, critical, tempo = 1, life: lifeProp, reduced: reducedProp }: DamageNumberProps) {
  const reduced = useFxReduced(reducedProp);
  const life = Math.min(FIGHT.number / tempo, lifeProp ?? Infinity);
  const fade = { duration: life, times: [0, 0.6, 1], ease: "linear" } as const;
  return (
    <motion.span
      data-fx="damage"
      aria-hidden="true"
      className={`pointer-events-none inline-block tabular [-webkit-text-stroke:3px_var(--color-paper)] [paint-order:stroke_fill] ${critical ? "text-title text-gold-ink" : "text-heading text-fx-vermilion"}`}
      initial={reduced ? { opacity: 1 } : { opacity: 1, scale: 1.4, y: 0 }}
      animate={reduced ? { opacity: [1, 1, 0] } : { opacity: [1, 1, 0], scale: 1, y: [0, 0, -24] }}
      transition={reduced ? fade : { scale: spring.bouncy, y: { duration: life, times: [0, 0.35, 1], ease: ease.out }, opacity: fade }}
    >
      {`−${value}`}
    </motion.span>
  );
}
