import { motion } from "motion/react";
import { ease, spring } from "@/ui/motion";
import { FIGHT, type Tempo } from "@/ui/fight/fightTiming";

/**
 * Floating damage, stamped on contact: `scale 1.4 → 1` (bouncy), then it rises 24 px and fades. A static paper outline
 * keeps it readable over the ink and the dark theme. Decorative: the blow is announced by the caller's live region.
 */
export function DamageNumber({ value, critical, tempo = 1 }: { value: number; critical: boolean; tempo?: Tempo }) {
  const life = FIGHT.number / tempo;
  return (
    <motion.span
      data-fx="damage"
      aria-hidden="true"
      className={`pointer-events-none inline-block tabular [-webkit-text-stroke:3px_var(--color-paper)] [paint-order:stroke_fill] ${critical ? "text-title text-gold-ink" : "text-heading text-fx-vermilion"}`}
      initial={{ opacity: 1, scale: 1.4, y: 0 }}
      animate={{ opacity: [1, 1, 0], scale: 1, y: [0, 0, -24] }}
      transition={{
        scale: spring.bouncy,
        y: { duration: life, times: [0, 0.35, 1], ease: ease.out },
        opacity: { duration: life, times: [0, 0.6, 1], ease: "linear" },
      }}
    >
      {`−${value}`}
    </motion.span>
  );
}
