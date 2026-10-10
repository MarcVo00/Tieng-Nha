import { AnimatePresence, motion } from "motion/react";
import { fr } from "@/i18n/fr";
import { duration } from "@/ui/motion";

type HeartsProps = { count: number; max: number };

function HeartShape({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width={24} height={24} fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20s-7.5-4.5-7.5-10A4.2 4.2 0 0 1 12 7.5 4.2 4.2 0 0 1 19.5 10c0 5.5-7.5 10-7.5 10Z" />
    </svg>
  );
}

export function Hearts({ count, max }: HeartsProps) {
  return (
    <span role="img" aria-label={fr.ui.hearts(count, max)} className="inline-flex items-center gap-1 tabular">
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className="relative inline-flex h-6 w-6 items-center justify-center text-line" aria-hidden="true">
          <HeartShape filled={false} />
          <AnimatePresence>
            {i < count ? (
              <motion.span
                key="full"
                className="absolute inset-0 text-primary"
                initial={{ scale: 1, opacity: 1 }}
                exit={{ scale: [1, 1.3, 0], opacity: [1, 1, 0], transition: { duration: duration.base } }}
              >
                <HeartShape filled />
              </motion.span>
            ) : null}
          </AnimatePresence>
        </span>
      ))}
    </span>
  );
}
