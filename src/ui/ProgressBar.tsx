import { motion } from "motion/react";
import { spring } from "@/ui/motion";

type ProgressBarProps = { value: number; label: string };

export function ProgressBar({ value, label }: ProgressBarProps) {
  const v = Math.min(1, Math.max(0, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)}
      className="h-3 w-full overflow-hidden rounded-full bg-surface-2"
    >
      <motion.div className="h-full w-full origin-left rounded-full bg-primary" initial={false} animate={{ scaleX: v }} transition={spring.soft} />
    </div>
  );
}
