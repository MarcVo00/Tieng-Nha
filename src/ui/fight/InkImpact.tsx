import type { ReactNode } from "react";
import { motion } from "motion/react";
import { duration, ease, spring } from "@/ui/motion";
import { FIGHT, type Tempo } from "@/ui/fight/fightTiming";
import type { Vec } from "@/ui/fight/useFightBeat";

// Đông Hồ print FX: a brush slash stamped on contact, ink droplets thrown in a fan along the blow, a vermilion seal.
// One <svg> per impact (2 paths, ≤ 12 circles), mounted on contact and unmounted with its beat by the caller.

export type ImpactKind = "hit" | "crit" | "ko" | "miss";

/** Droplets per impact: the particle budget (audit §C.3). */
export const DROPLETS: Record<ImpactKind, number> = { hit: 6, crit: 10, ko: 12, miss: 0 };
const SIZE = 96;
const C = SIZE / 2;
const FAN = 1.9; // radians, centred on the blow direction
const INK = "var(--fx-ink)";
const VERMILION = "var(--fx-vermilion)";
const GOLD = "var(--fx-gold)";
const PAPER = "var(--color-paper)";

type Drop = { dx: number; dy: number; r: number; fill: string };

/** Deterministic fan of droplets: 12 to 28 px out, alternating pigments for criticals (gold) and K.-O. (vermilion). */
export function droplets(kind: ImpactKind, dir: Vec): Drop[] {
  const n = DROPLETS[kind];
  const a0 = Math.atan2(dir.y, dir.x);
  return Array.from({ length: n }, (_, i) => {
    const a = a0 + (n === 1 ? 0 : (i / (n - 1) - 0.5) * FAN);
    const dist = 12 + ((i * 7) % 5) * 4;
    const accent = i % 2 === 1 ? (kind === "crit" ? GOLD : kind === "ko" ? VERMILION : INK) : INK;
    return { dx: Math.round(Math.cos(a) * dist), dy: Math.round(Math.sin(a) * dist), r: 2 + (i % 3) * 0.8, fill: accent };
  });
}

type InkImpactProps = {
  kind: ImpactKind;
  /** Centre of the impact in the stage (px). */
  x: number;
  y: number;
  /** Direction of the blow (any length); the droplets fly along it and the slash is mirrored for right-to-left blows. */
  dir?: Vec;
  tempo?: Tempo;
};

export function InkImpact({ kind, x, y, dir = { x: 1, y: 0 }, tempo = 1 }: InkImpactProps) {
  const life = (FIGHT.hitStop + duration.slow) / tempo;
  const stamp = FIGHT.strike / tempo;
  const miss = kind === "miss";
  const slash = kind === "crit" ? VERMILION : INK;
  const mirror = dir.x < 0 ? `scale(-1 1)` : "";
  return (
    <motion.svg
      data-fx="impact"
      data-kind={kind}
      aria-hidden="true"
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      width={SIZE}
      height={SIZE}
      className="pointer-events-none absolute overflow-visible"
      style={{ left: x - C, top: y - C }}
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: [0, 1, 1, 0], scale: [0.6, 1.1, 1] }}
      transition={{
        opacity: { duration: life, times: [0, stamp / life, 0.7, 1], ease: "linear" },
        scale: { duration: stamp * 2, times: [0, 0.5, 1], ease: ease.out },
      }}
    >
      <g transform={`translate(${C} ${C}) ${mirror} translate(${-C} ${-C})`} opacity={miss ? 0.55 : 1}>
        <motion.path
          d="M15 75 C36 54 57 36 84 15"
          fill="none"
          stroke={slash}
          strokeWidth={miss ? 4 : 7}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: stamp, ease: ease.out }}
        />
        <motion.path
          d="M21 45 C39 45 60 51 75 63"
          fill="none"
          stroke={slash}
          strokeWidth={miss ? 2.5 : 4}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: stamp, ease: ease.out, delay: stamp / 2 }}
        />
      </g>
      {droplets(kind, dir).map((d, i) => (
        <motion.circle
          key={i}
          cx={C}
          cy={C}
          r={d.r}
          fill={d.fill}
          stroke={PAPER}
          strokeWidth={1}
          initial={{ x: 0, y: 0, scale: 1 }}
          animate={{ x: d.dx, y: d.dy, scale: 0.4 }}
          transition={{ duration: FIGHT.recoil / tempo, ease: ease.out }}
        />
      ))}
    </motion.svg>
  );
}

/** A vermilion seal stamped on the stage: « Chí mạng! » on a critical, « K.-O. » on the knock-out blow. */
export function FightSeal({ children, big = false, lang }: { children: ReactNode; big?: boolean; lang?: string }) {
  return (
    <motion.span
      data-fx="seal"
      {...(lang ? { lang } : {})}
      className={`pointer-events-none inline-block whitespace-nowrap rounded-sm border-2 border-paper bg-fx-vermilion px-2 py-0.5 text-paper shadow-card ${big ? "text-title" : "text-heading"}`}
      initial={{ opacity: 0, scale: 1.6, rotate: -6 }}
      animate={{ opacity: 1, scale: 1, rotate: -6 }}
      transition={{ scale: spring.bouncy, opacity: { duration: FIGHT.strike } }}
    >
      {children}
    </motion.span>
  );
}

/** The gold glint on the attacker's hand while a critical winds up: a 4-point star of 2 strokes, 0 → 1 → 0. */
export function CritGlint({ tempo = 1 }: { tempo?: Tempo }) {
  return (
    <motion.svg
      data-fx="glint"
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={28}
      height={28}
      className="pointer-events-none"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: [0, 1, 0], opacity: [0, 1, 0] }}
      transition={{ duration: FIGHT.anticipation / tempo, delay: (duration.slow - FIGHT.anticipation) / tempo, ease: ease.out }}
    >
      <path d="M12 1 V23 M1 12 H23" stroke={GOLD} strokeWidth={3} strokeLinecap="round" />
    </motion.svg>
  );
}

/** « Raté » brushed near the attacker: muted text and a short ink stroke, no pill. */
export function MissMark({ children }: { children: ReactNode }) {
  const tone = "text-ink-muted";
  return (
    <motion.span
      data-fx="miss"
      className="pointer-events-none flex flex-col items-center"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: [0, 1, 1, 0], y: [6, 0, -2, -6] }}
      transition={{ duration: duration.celebrate, times: [0, 0.2, 0.75, 1], ease: ease.out }}
    >
      <span className={`whitespace-nowrap text-body-strong ${tone}`}>{children}</span>
      <svg aria-hidden="true" viewBox="0 0 48 6" width={40} height={5}>
        <path d="M2 4 C14 1 32 1 46 3" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className={tone} />
      </svg>
    </motion.span>
  );
}
