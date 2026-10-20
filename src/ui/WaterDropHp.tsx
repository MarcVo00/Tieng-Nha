import { AnimatePresence, motion } from "motion/react";
import { duration, ease } from "@/ui/motion";
import { useFxReduced } from "@/ui/fight/InkImpact";

type WaterDropHpProps = {
  value: number;
  max: number;
  /** Accessible name of the progressbar (required unless decorative). */
  label?: string;
  /** An illustration (the boss intro): hidden from assistive tech, no progressbar role. */
  decorative?: boolean;
  /** Fade only: the lost drop does not fall. Defaults to the user's reduced-motion setting. */
  reduced?: boolean;
};

const DROP = "M6 1 C6 1 1 7.5 1 10.5 A5 5 0 0 0 11 10.5 C11 7.5 6 1 6 1 Z";

function Drop({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 12 16" width={12} height={16} aria-hidden="true" className="block overflow-visible">
      <path d={DROP} fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" />
      {/* A small paper wave inside the drop: Thủy Tinh's signature. */}
      {filled ? <path d="M3.4 11 c1-1 1.8-1 2.6 0 s1.6 1 2.6 0" fill="none" stroke="var(--color-paper)" strokeWidth={1.2} strokeLinecap="round" /> : null}
    </svg>
  );
}

/**
 * The boss's HP as segmented water drops (audit §C.2). A lost drop detaches and falls (`y +18`, `rotate 30°`, fade,
 * `duration.slow`), transform/opacity only; under reduced motion it simply fades.
 */
export function WaterDropHp({ value, max, label, decorative = false, reduced: reducedProp }: WaterDropHpProps) {
  const reduced = useFxReduced(reducedProp);
  const a11y = decorative
    ? { "aria-hidden": true as const }
    : { role: "progressbar", "aria-label": label, "aria-valuemin": 0, "aria-valuemax": max, "aria-valuenow": value };
  return (
    <span {...a11y} className="inline-flex items-center gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <span key={i} data-drop={i < value ? "full" : "empty"} className="relative block h-4 w-3 text-line">
          <Drop filled={false} />
          <AnimatePresence initial={false}>
            {i < value ? (
              <motion.span
                key="full"
                className="absolute inset-0 origin-bottom text-info"
                initial={{ opacity: 1 }}
                exit={
                  reduced
                    ? { opacity: 0, transition: { duration: duration.fast } }
                    : { y: 18, rotate: 30, opacity: 0, transition: { duration: duration.slow, ease: ease.in } }
                }
              >
                <Drop filled />
              </motion.span>
            ) : null}
          </AnimatePresence>
        </span>
      ))}
    </span>
  );
}
