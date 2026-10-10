import { motion, useReducedMotion } from "motion/react";
import { duration } from "@/ui/motion";

type SkeletonProps = { className?: string; lines?: number };

export function Skeleton({ className, lines = 1 }: SkeletonProps) {
  const reduced = useReducedMotion();
  return (
    <div className="flex flex-col gap-2" aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className={`relative h-4 overflow-hidden rounded-sm bg-surface-2 ${className ?? ""}`}>
          {reduced ? null : (
            <motion.span
              className="absolute inset-0 bg-surface opacity-60"
              initial={{ x: "-100%" }}
              animate={{ x: "100%" }}
              transition={{ duration: duration.loop, repeat: Infinity, ease: "linear", repeatDelay: 0.2 }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
