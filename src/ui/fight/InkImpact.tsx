import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { duration, ease, spring } from "@/ui/motion";
import { FIGHT, type Tempo } from "@/ui/fight/fightTiming";
import type { Vec } from "@/ui/fight/useFightBeat";

// Đông Hồ print FX: a brush slash stamped on contact, ink droplets thrown in a fan along the blow, a vermilion seal.
// One <svg> per impact (2 paths, ≤ 12 circles), mounted on contact and unmounted with its beat by the caller. Each FX
// takes the time it has left (`life`) so it has faded out before it is unmounted, and has a `reduced` path (fade only).

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

/** The explicit `reduced` prop wins; otherwise the user's setting. */
export function useFxReduced(prop: boolean | undefined): boolean {
  const system = useReducedMotion() === true;
  return prop ?? system;
}

type InkImpactProps = {
  kind: ImpactKind;
  /** Centre of the impact in the stage (px). */
  x: number;
  y: number;
  /** Direction of the blow (any length); the droplets fly along it and the slash is mirrored for right-to-left blows. */
  dir?: Vec;
  tempo?: Tempo;
  /** Seconds until the caller unmounts it (the end of its beat: hit-stop + recoil); it has faded out by then. */
  life?: number;
  /** Fade only: the slash is simply there, no stamp, no droplet. Defaults to the user's reduced-motion setting. */
  reduced?: boolean;
};

export function InkImpact({ kind, x, y, dir = { x: 1, y: 0 }, tempo = 1, life: lifeProp, reduced: reducedProp }: InkImpactProps) {
  const reduced = useFxReduced(reducedProp);
  const life = lifeProp ?? (FIGHT.hitStop + FIGHT.recoil) / tempo;
  const stamp = Math.min(FIGHT.strike / tempo, life / 3);
  const miss = kind === "miss";
  const slash = kind === "crit" ? VERMILION : INK;
  const mirror = dir.x < 0 ? "scale(-1 1)" : "";
  const fade = { duration: life, times: [0, stamp / life, 0.6, 1], ease: "linear" } as const;
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
      initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
      animate={reduced ? { opacity: [0, 1, 1, 0] } : { opacity: [0, 1, 1, 0], scale: [0.6, 1.1, 1] }}
      transition={reduced ? fade : { opacity: fade, scale: { duration: stamp * 2, times: [0, 0.5, 1], ease: ease.out } }}
    >
      <g transform={`translate(${C} ${C}) ${mirror} translate(${-C} ${-C})`} opacity={miss ? 0.55 : 1}>
        <motion.path
          d="M15 75 C36 54 57 36 84 15"
          fill="none"
          stroke={slash}
          strokeWidth={miss ? 4 : 7}
          strokeLinecap="round"
          initial={{ pathLength: reduced ? 1 : 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: stamp, ease: ease.out }}
        />
        <motion.path
          d="M21 45 C39 45 60 51 75 63"
          fill="none"
          stroke={slash}
          strokeWidth={miss ? 2.5 : 4}
          strokeLinecap="round"
          initial={{ pathLength: reduced ? 1 : 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: stamp, ease: ease.out, delay: stamp / 2 }}
        />
      </g>
      {reduced
        ? null
        : droplets(kind, dir).map((d, i) => (
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
              transition={{ duration: Math.min(FIGHT.recoil / tempo, life), ease: ease.out }}
            />
          ))}
    </motion.svg>
  );
}

type SealProps = {
  children: ReactNode;
  big?: boolean;
  lang?: string;
  /** Seconds until the caller unmounts it: it fades out over its last `FIGHT.strike`. */
  life?: number;
  /** Fade only (no stamp). Defaults to the user's reduced-motion setting. */
  reduced?: boolean;
};

/** A vermilion seal stamped on the stage: « Chí mạng! » on a critical, « K.-O. » on the knock-out blow. */
export function FightSeal({ children, big = false, lang, life, reduced: reducedProp }: SealProps) {
  const reduced = useFxReduced(reducedProp);
  const fadeIn = life === undefined ? FIGHT.strike : Math.min(FIGHT.strike, life / 4);
  const opacity =
    life === undefined
      ? { to: 1, transition: { duration: fadeIn } }
      : {
          to: [0, 1, 1, 0],
          transition: { duration: life, times: [0, fadeIn / life, Math.max(fadeIn / life, 1 - FIGHT.strike / life), 1], ease: "linear" as const },
        };
  return (
    <motion.span
      data-fx="seal"
      {...(lang ? { lang } : {})}
      className={`pointer-events-none inline-block -rotate-6 whitespace-nowrap rounded-sm border-2 border-paper bg-fx-vermilion px-2 py-0.5 text-paper shadow-card ${big ? "text-title" : "text-heading"}`}
      initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 1.6 }}
      animate={reduced ? { opacity: opacity.to } : { opacity: opacity.to, scale: 1 }}
      transition={reduced ? opacity.transition : { scale: spring.bouncy, opacity: opacity.transition }}
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

/**
 * « Raté » brushed near the attacker: ink text and a short muted stroke, no pill. It fades in over `FIGHT.strike`, then
 * holds still (no running animation) whatever the tempo; the caller sets `leaving` once it has been readable long
 * enough (≈ `duration.celebrate`) and it fades out over `FIGHT.strike`.
 */
export function MissMark({ children, leaving = false }: { children: ReactNode; leaving?: boolean }) {
  return (
    <motion.span
      data-fx="miss"
      data-leaving={leaving ? "true" : "false"}
      className="pointer-events-none flex flex-col items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: leaving ? 0 : 1 }}
      transition={{ duration: FIGHT.strike, ease: ease.out }}
    >
      <span className="whitespace-nowrap text-body-strong text-ink">{children}</span>
      <svg aria-hidden="true" viewBox="0 0 48 6" width={40} height={5}>
        <path d="M2 4 C14 1 32 1 46 3" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="text-ink-muted" />
      </svg>
    </motion.span>
  );
}
