import { useCallback, useMemo } from "react";
import { useAnimationControls, useReducedMotion, type AnimationControls, type Transition } from "motion/react";
import { ease } from "@/ui/motion";
import { blowTiming, missTiming, type BeatOptions, type BlowKind, type Tempo } from "@/ui/fight/fightTiming";

// One fight beat on two fighters and the stage: anticipation → strike → hit-stop → recoil → settle. The hit-stop is a
// value held between two keyframes, never a timer pause, so a beat is a single animation per element. Positions come
// from constants given by the caller (no DOM measurement during a beat), and only transform/opacity are animated.

export type Vec = { x: number; y: number };
/** A fighter's body (lunge, recoil, hops) and its paper flash plate (opacity only). */
export type FighterControls = { body: AnimationControls; flash: AnimationControls };

export function useFighterControls(): FighterControls {
  const body = useAnimationControls();
  const flash = useAnimationControls();
  // Stable identity: a beat effect depending on it must not re-run (and restart its animations) on every render.
  return useMemo(() => ({ body, flash }), [body, flash]);
}

/** Animated properties of a beat: transform and opacity only. */
export type FightProp = "x" | "y" | "rotate" | "scaleX" | "scaleY" | "opacity";
/** `null` as a first keyframe starts from the current value (a fighter still settling from the previous beat). */
export type Frames = number[] | [null, ...number[]];
export type Keyframes = { [K in FightProp]?: Frames } & { transition: Transition };
/** From the current value, so a beat never snaps a fighter that is still moving. */
const fromHere = (values: number[]): [null, ...number[]] => [null, ...values.slice(1)];

const unit = (v: Vec): Vec => {
  const n = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / n, y: v.y / n };
};
const sign = (v: Vec): 1 | -1 => (v.x < 0 ? -1 : 1);
const along = (u: Vec, ds: number[], axis: "x" | "y") => ds.map((d) => Math.round(u[axis] * d * 10) / 10 || 0);

/** Shares of the reach covered by the strike (contact): 30 %, half the way for a critical. */
export const REACH = { hit: 0.3, crit: 0.5 } as const;
/** Recoil distances (px) and tilts (deg) of the defender. */
export const KNOCK = { hit: { push: 14, tilt: 8 }, crit: { push: 28, tilt: 14 } } as const;
const WIND_UP = 10; // px backwards
const JOLT = 4; // px on contact, held during the hit-stop
/** The jolt takes a quarter of the hit-stop, the rest is held. */
const JOLT_AT = 0.25;

/** The attacker: crouch backwards, rush to the contact, hold the frame, settle back. `reach` goes to the defender. */
export function strikeKeyframes(kind: BlowKind, reach: Vec, opts: BeatOptions = {}): Keyframes {
  const t = blowTiming(kind, opts);
  const u = unit(reach);
  const d = sign(reach);
  const contact = Math.hypot(reach.x, reach.y) * REACH[kind];
  const T = t.attackerLength;
  const times = [0, t.anticipation / T, t.impact / T, (t.impact + t.hitStop) / T, 1];
  const ds = [0, -WIND_UP, contact, contact, 0];
  return {
    x: fromHere(along(u, ds, "x")),
    y: fromHere(along(u, ds, "y")),
    scaleX: fromHere([1, 1.04, 0.97, 0.97, 1]),
    scaleY: fromHere([1, 0.94, 1.06, 1.06, 1]),
    rotate: fromHere([0, -4 * d, 6 * d, 6 * d, 0]),
    transition: { duration: T, times, ease: [ease.inOut, ease.in, "linear", ease.out] },
  };
}

/** The defender: still until the contact, a small jolt held through the hit-stop, thrown back, springs back. */
export function recoilKeyframes(kind: BlowKind, reach: Vec, opts: BeatOptions = {}): Keyframes {
  const t = blowTiming(kind, opts);
  const u = unit(reach);
  const d = sign(reach);
  const k = KNOCK[kind];
  const T = t.length;
  const stop = t.impact + t.hitStop;
  const times = [0, t.impact / T, (t.impact + t.hitStop * JOLT_AT) / T, stop / T, (stop + t.recoil * 0.35) / T, 1];
  const ds = [0, 0, JOLT, JOLT, k.push, 0];
  return {
    x: fromHere(along(u, ds, "x")),
    y: fromHere(along(u, ds, "y")),
    rotate: fromHere([0, 0, 2 * d, 2 * d, k.tilt * d, 0]),
    transition: { duration: T, times, ease: ["linear", ease.out, "linear", ease.out, ease.inOut] },
  };
}

/** The paper plate over the hit fighter flashes 0 → 0.7 → 0 during the hit-stop (instead of blinking the fighter). */
export function flashKeyframes(kind: BlowKind, opts: BeatOptions = {}): Keyframes {
  const t = blowTiming(kind, opts);
  const T = t.impact + t.hitStop;
  return { opacity: [0, 0, 0.7, 0], transition: { duration: T, times: [0, t.impact / T, (t.impact + t.hitStop * JOLT_AT) / T, 1], ease: "linear" } };
}

/** The stage shakes once during the hit-stop: ±4 px, a critical or a K.-O. ±8 px twice. */
export function shakeKeyframes(kind: BlowKind, opts: BeatOptions = {}): Keyframes {
  const t = blowTiming(kind, opts);
  const big = kind === "crit" || opts.ko === true;
  const amp = big ? [8, -8, 8, -8] : [4, -4];
  const T = t.impact + t.hitStop;
  const step = t.hitStop / (amp.length + 1);
  const times = [0, t.impact / T, ...amp.map((_, i) => (t.impact + step * (i + 1)) / T), 1];
  return { x: [0, 0, ...amp, 0], transition: { duration: T, times, ease: "linear" } };
}

/** A miss: wind-up, a swing into the air beside the defender, the attacker tips over and catches itself. */
export function missKeyframes(reach: Vec, tempo: Tempo = 1): Keyframes {
  const { length } = missTiming(tempo);
  const u = unit(reach);
  const d = sign(reach);
  const ds = [0, -WIND_UP, 26, 18, 0];
  return {
    x: fromHere(along(u, ds, "x")),
    y: fromHere(along(u, ds, "y").map((v, i) => (i === 2 ? v - 8 : i === 3 ? v + 6 : v))),
    rotate: fromHere([0, -4 * d, 18 * d, -6 * d, 0]),
    transition: { duration: length, times: [0, 0.2, 0.45, 0.75, 1], ease: [ease.inOut, ease.in, ease.out, ease.inOut] },
  };
}

/** The defender sidesteps a miss: 12 px away from the blow and back. */
export function dodgeKeyframes(reach: Vec, tempo: Tempo = 1): Keyframes {
  const { length } = missTiming(tempo);
  return { x: [null, 0, 12 * sign(reach), 0], transition: { duration: length, times: [0, 0.3, 0.55, 1], ease: [ease.out, ease.out, ease.inOut] } };
}

export type BlowBeat = {
  kind: BlowKind;
  ko?: boolean;
  tempo?: Tempo;
  compact?: boolean;
  attacker: FighterControls;
  defender: FighterControls;
  stage?: AnimationControls;
  /** From the attacker's resting place to the defender's (px). */
  reach: Vec;
};
export type MissBeat = { tempo?: Tempo; attackers: { controls: FighterControls; reach: Vec }[]; dodgers?: { controls: FighterControls; reach: Vec }[] };

/**
 * Plays fight beats. Returns the beat's timing (seconds) so the caller schedules what happens on contact (face, HP)
 * and the next beat. Under reduced motion only the paper flash plays: nothing moves, shakes or flies.
 */
export function useFightBeat() {
  const reduced = useReducedMotion() === true;
  const blow = useCallback(
    (b: BlowBeat) => {
      const opts: BeatOptions = { ko: b.ko === true, tempo: b.tempo ?? 1, compact: b.compact === true };
      void b.defender.flash.start(flashKeyframes(b.kind, opts));
      if (!reduced) {
        void b.attacker.body.start(strikeKeyframes(b.kind, b.reach, opts));
        void b.defender.body.start(recoilKeyframes(b.kind, b.reach, opts));
        if (b.stage) void b.stage.start(shakeKeyframes(b.kind, opts));
      }
      return blowTiming(b.kind, opts);
    },
    [reduced],
  );
  const miss = useCallback(
    (m: MissBeat) => {
      const tempo = m.tempo ?? 1;
      if (!reduced) {
        for (const a of m.attackers) void a.controls.body.start(missKeyframes(a.reach, tempo));
        for (const a of m.dodgers ?? []) void a.controls.body.start(dodgeKeyframes(a.reach, tempo));
      }
      return missTiming(tempo);
    },
    [reduced],
  );
  return useMemo(() => ({ blow, miss, reduced }), [blow, miss, reduced]);
}
