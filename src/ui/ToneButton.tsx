import { motion } from "motion/react";
import type { Tone } from "@/domain/types";
import { spring, tap } from "@/ui/motion";
import { TONE_UI } from "@/ui/ToneMark";

type ToneButtonProps = { tone: Tone; selected: boolean; state?: "idle" | "correct" | "wrong"; onClick: () => void };

// Mini pitch contours: flat, falling, rising, dip-rise, broken-rise, short-drop.
const CONTOUR: Record<Tone, string> = {
  ngang: "M4 12h32",
  huyen: "M4 8c8 0 20 4 32 12",
  sac: "M4 20c10-2 20-8 32-14",
  hoi: "M4 10c6 2 12 8 16 8s8-4 16-10",
  nga: "M4 16c4-6 8-8 11-2s6 2 8 2c4 0 8-4 13-8",
  nang: "M4 8c8 2 18 6 24 12",
};

const STATE = {
  idle: "border-line bg-surface",
  correct: "border-success bg-success-soft",
  wrong: "border-error bg-error-soft",
} as const;

export function ToneButton({ tone, selected, state = "idle", onClick }: ToneButtonProps) {
  const ui = TONE_UI[tone];
  return (
    <motion.button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      whileTap={tap}
      animate={state === "wrong" ? { x: [0, -6, 6, -4, 4, 0] } : state === "correct" ? { scale: [1, 1.06, 1] } : { x: 0, scale: 1 }}
      transition={state === "idle" ? spring.snappy : { duration: 0.3 }}
      className={`flex min-h-16 min-w-11 flex-col items-center justify-center gap-1 rounded-sm border-2 px-2 py-2 ${STATE[state]} ${selected ? "ring-2 ring-primary" : ""} ${ui.className}`}
    >
      <svg viewBox="0 0 40 28" width={40} height={28} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={CONTOUR[tone]} />
      </svg>
      <span className="text-caption text-ink" lang="vi">
        {ui.name}
      </span>
    </motion.button>
  );
}
