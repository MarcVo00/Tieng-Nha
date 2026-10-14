import type { ReactNode } from "react";
import { MotionConfig, PresenceContext, motion } from "motion/react";
import { duration, EXIT_RATIO, spring } from "@/ui/motion";

type PageTransitionProps = { children?: ReactNode; variant: "tab" | "focus" };

/**
 * Page content never takes part in the page's exit: the page leaves as one block. In motion 11, a layout-animated
 * element (`layout`, `layoutId`) registers with the surrounding presence but never unregisters when it unmounts, so
 * one that comes and goes inside a page (a tab underline, a re-keyed list row) would keep the exit pending forever
 * and <AnimatePresence mode="wait"> would never mount the next page.
 */
function Isolated({ children }: { children?: ReactNode }) {
  return <PresenceContext.Provider value={null}>{children}</PresenceContext.Provider>;
}

/** Wrap in <AnimatePresence mode="wait"> and pass `key={pathname}` from the parent. */
export function PageTransition({ children, variant }: PageTransitionProps) {
  if (variant === "focus") {
    return (
      <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={spring.soft}>
        <Isolated>{children}</Isolated>
      </motion.div>
    );
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: duration.fast * EXIT_RATIO } }}
      transition={{ duration: duration.fast }}
    >
      <Isolated>{children}</Isolated>
    </motion.div>
  );
}

/** Root provider: with prefers-reduced-motion, movement is dropped and only fades remain. */
export function MotionRoot({ children }: { children?: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
