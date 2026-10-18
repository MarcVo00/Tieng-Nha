import { motion } from "motion/react";
import { fr } from "@/i18n/fr";
import { Icon } from "@/ui/icons";
import { spring } from "@/ui/motion";

type BadgeMedalProps = {
  icon: string;
  title: string;
  unlocked: boolean;
  size?: "sm" | "lg";
  /** Already-localised reward caption, shown under the title (e.g. a frame name). */
  reward?: string;
};

export function BadgeMedal({ icon, title, unlocked, size = "sm", reward }: BadgeMedalProps) {
  const dim = size === "lg" ? "h-24 w-24 text-display" : "h-16 w-16 text-title";
  return (
    <figure className="m-0 flex flex-col items-center gap-1.5">
      <motion.div
        initial={unlocked ? { scale: 0 } : false}
        animate={{ scale: 1 }}
        transition={spring.bouncy}
        className={`relative flex items-center justify-center rounded-full border-4 leading-none ${dim} ${unlocked ? "border-gold bg-surface shadow-card" : "border-line bg-surface-2"}`}
      >
        {unlocked ? (
          <span aria-hidden="true">{icon}</span>
        ) : (
          <>
            <span aria-hidden="true" className="opacity-30 grayscale">
              {icon}
            </span>
            <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-surface text-ink-muted shadow-card">
              <Icon name="lock" size={14} />
            </span>
          </>
        )}
      </motion.div>
      <figcaption className={`max-w-24 text-center text-caption ${unlocked ? "text-ink" : "text-ink-muted"}`}>
        {title}
        {unlocked ? null : <span className="sr-only">{`, ${fr.ui.badge.locked}`}</span>}
      </figcaption>
      {reward ? <p className="m-0 max-w-28 text-center text-caption text-gold-ink">{reward}</p> : null}
    </figure>
  );
}
