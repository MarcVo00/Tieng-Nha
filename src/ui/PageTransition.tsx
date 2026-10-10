import type { ReactNode } from "react";
import { MotionConfig, motion } from "motion/react";
import { duration, EXIT_RATIO, spring } from "@/ui/motion";

type PageTransitionProps = { children?: ReactNode; variant: "tab" | "focus" };

/** Wrap in <AnimatePresence mode="wait"> and pass `key={pathname}` from the parent. */
export function PageTransition({ children, variant }: PageTransitionProps) {
  if (variant === "focus") {
    return (
      <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={spring.soft}>
        {children}
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
      {children}
    </motion.div>
  );
}

/** Root provider: with prefers-reduced-motion, movement is dropped and only fades remain. */
export function MotionRoot({ children }: { children?: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
