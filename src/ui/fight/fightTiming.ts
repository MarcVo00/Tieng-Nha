import { duration } from "@/ui/motion";

/** Fight beat tokens (design-system §6.2), composed from the motion tokens: no raw value of their own. Seconds. */
export const FIGHT = {
  anticipation: duration.fast, // 150 ms wind-up
  strike: duration.instant, // 80 ms strike
  hitStop: duration.instant, // 80 ms held frame on a normal blow
  critHitStop: duration.instant * 2, // 160 ms
  koHitStop: duration.instant * 3, // 240 ms
  recoil: duration.base, // 220 ms
  settle: duration.slow, // 360 ms back in place
  number: duration.celebrate, // 800 ms floating damage (never blocking)
} as const;
// Springs: KO / bow = spring.soft; damage number and seals = spring.bouncy. The recoil is a keyframe (ease.out, then
// ease.inOut), not spring.snappy: a spring only interpolates two values and the hit-stop holds one in between.

/** A landed blow. A K.-O. is a landed blow (hit or crit) with a longer hit-stop. */
export type BlowKind = "hit" | "crit";
/** Playback speed, ≥ 1: 1 = normal, 2 = twice as fast (the blows after a K.-O., or a long fight squeezed into its budget). */
export type Tempo = number;

export type BlowTiming = {
  anticipation: number;
  strike: number;
  hitStop: number;
  recoil: number;
  settle: number;
  /** From the start of the beat to the contact. */
  impact: number;
  /** The defender's part: contact, hit-stop, recoil. The next beat starts here, during the attacker's settle. */
  length: number;
  /** The attacker's part: wind-up, strike, held frame, settle (it overlaps the next beat by settle − recoil). */
  attackerLength: number;
};

/** Beat timings of a landed blow. A critical winds up longer (`slow`) and holds its frame twice as long. */
export function blowTiming(kind: BlowKind, opts: { ko?: boolean; tempo?: Tempo } = {}): BlowTiming {
  const t = opts.tempo ?? 1;
  const anticipation = (kind === "crit" ? duration.slow : FIGHT.anticipation) / t;
  const strike = FIGHT.strike / t;
  const hitStop = (opts.ko === true ? FIGHT.koHitStop : kind === "crit" ? FIGHT.critHitStop : FIGHT.hitStop) / t;
  const recoil = FIGHT.recoil / t;
  const settle = FIGHT.settle / t;
  const impact = anticipation + strike;
  return { anticipation, strike, hitStop, recoil, settle, impact, length: impact + hitStop + recoil, attackerLength: impact + hitStop + settle };
}

export type MissTiming = { impact: number; length: number };

/** A miss (or a group of consecutive misses): one 360 ms beat, the swing cuts the air at 45 %. */
export function missTiming(tempo: Tempo = 1): MissTiming {
  const length = duration.slow / tempo;
  return { impact: length * MISS_SWING, length };
}

/** Share of the miss beat at which the swing cuts the air. */
export const MISS_SWING = 0.45;
