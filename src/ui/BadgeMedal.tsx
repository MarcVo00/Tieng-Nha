import { motion } from "motion/react";
import { fr } from "@/i18n/fr";
import { spring } from "@/ui/motion";

type BadgeMedalProps = {
  icon: string;
  title: string;
  unlocked: boolean;
  size?: "sm" | "lg";
  /** Already-localised reward caption, shown under the title (e.g. « + cadre Jade »). */
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
        className={`relative flex items-center justify-center rounded-full leading-none ${dim} ${unlocked ? "border-4 border-gold bg-surface shadow-card" : "border-2 border-dashed border-gold-ink bg-transparent"}`}
      >
        {unlocked ? (
          <>
            <span aria-hidden="true">{icon}</span>
            {/* Ribbon tails under the medal. */}
            <svg aria-hidden="true" focusable="false" viewBox="0 0 24 12" width={24} height={12} className="absolute -bottom-2.5 left-1/2 -z-10 -translate-x-1/2 fill-primary">
              <path d="M2 0h8v12l-4-3-4 3ZM14 0h8v12l-4-3-4 3Z" />
            </svg>
          </>
        ) : (
          // An empty inlay in the lacquer: a faint silhouette of the badge, kept static.
          <span aria-hidden="true" className="opacity-20 grayscale">
            {icon}
          </span>
        )}
      </motion.div>
      <figcaption className={`max-w-24 text-center text-caption ${unlocked ? "text-ink" : "text-ink-muted"}`}>
        {title}
        {reward ? <span className="block text-gold-ink">{reward}</span> : null}
        {unlocked ? null : <span className="sr-only">{`, ${fr.ui.badge.locked}`}</span>}
      </figcaption>
    </figure>
  );
}

/** Spreadable `reward` prop for a freshly unlocked badge: the reward kind and name, or nothing when it has no (known) reward. */
export function rewardProp(badge: { reward?: string | undefined }): { reward?: string } {
  const c = badge.reward ? fr.rewards.caption[badge.reward] : undefined;
  return c ? { reward: fr.rewards.gained(c.kind, c.name) } : {};
}
