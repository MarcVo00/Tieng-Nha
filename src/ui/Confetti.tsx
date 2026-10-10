import { useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";
import { duration, ease } from "@/ui/motion";

type ConfettiProps = { fire: boolean };

const COLORS = ["bg-gold", "bg-primary", "bg-success"] as const;
const COUNT = 24;

// Deterministic PRNG so pieces are stable across renders (fixed seed).
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function Confetti({ fire }: ConfettiProps) {
  const reduced = useReducedMotion();
  const pieces = useMemo(() => {
    const rnd = mulberry32(1909);
    return Array.from({ length: COUNT }, (_, i) => ({
      color: COLORS[i % COLORS.length],
      x: (rnd() - 0.5) * 320,
      y: -80 - rnd() * 220,
      fall: 160 + rnd() * 160,
      rotate: 180 + rnd() * 360,
    }));
  }, []);

  if (!fire || reduced) return null;
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden" aria-hidden="true">
      {pieces.map((p, i) => (
        <motion.div
          key={i}
          className={`absolute h-2 w-2 ${p.color}`}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 45 }}
          animate={{ x: p.x, y: [0, p.y, p.fall], opacity: [1, 1, 0], rotate: 45 + p.rotate }}
          transition={{ duration: duration.celebrate, ease: ease.out, times: [0, 0.45, 1] }}
        />
      ))}
    </div>
  );
}
