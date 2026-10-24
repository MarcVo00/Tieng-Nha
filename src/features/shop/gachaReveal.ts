import type { GachaPullItem } from "@/domain/types";
import { RARITY_ORDER } from "@/services/gacha";
import { duration } from "@/ui/motion";

// The « Xin xăm » reveal as data: beat lengths composed from the motion tokens (like `FIGHT`), constant stage
// geometry (no DOM measure during the animation) and the sequence as a reducer. The animation is decor: nothing here
// ever changes the pull, so skipping shows exactly what the server drew.

/** Reveal beats in seconds, composed from `duration` (no raw value of their own). */
export const REVEAL = {
  /** One shake of the tube (±6°, the sticks rattle). A tap = one shake; holding repeats it up to `maxShakes`. */
  shake: duration.slow * 2,
  maxShakes: 3,
  /** One stick: out of the mouth, then down onto the altar. */
  fall: duration.slow,
  /** Between two sticks of a x10 fan. */
  fallStagger: duration.fast,
  /** The tube steps aside (opacity) while a x10 fans out. */
  tubeFade: duration.base,
  /** The paper scroll unrolls from its top roller (scaleY). */
  unroll: duration.slow,
  /** The scroll content fades in once the paper is open. */
  content: duration.base,
  /** The rarity seal is stamped after the content (spring.bouncy). */
  seal: duration.slow + duration.base,
  /** Legendary: the static gold rays fade in, then the whole scene holds its breath before the unroll. */
  raysIn: duration.slow,
  legendaryHold: duration.slow + duration.celebrate,
} as const;

/** Performance budgets (audit §D.4). */
export const BUDGET = { animated: 8, particles: 12 } as const;

export type Span = { delay: number; length: number };

/** When each stick of a pull starts falling and for how long. */
export function fallSchedule(count: number): Span[] {
  return Array.from({ length: count }, (_, i) => ({ delay: i * REVEAL.fallStagger, length: REVEAL.fall }));
}

/** From the first stick leaving the tube to the last one at rest. */
export function fallTotal(count: number): number {
  return count <= 0 ? 0 : (count - 1) * REVEAL.fallStagger + REVEAL.fall;
}

/** The largest number of spans running at the same instant (a span ending as another starts does not overlap). */
export function peakConcurrency(spans: readonly Span[]): number {
  const edges = spans.flatMap((s) => [
    { t: s.delay, d: 1 },
    { t: s.delay + s.length, d: -1 },
  ]);
  edges.sort((a, b) => a.t - b.t || a.d - b.d);
  let now = 0;
  let peak = 0;
  for (const e of edges) {
    now += e.d;
    peak = Math.max(peak, now);
  }
  return peak;
}

// --- Stage geometry (px, the stage is a fixed 256 x 264 box: it fits a 320 px phone with its gutters) ---

export const STAGE = { w: 256, h: 264 } as const;
const ART = STAGE.w / 240; // the altar art is drawn on a 240-wide canvas
/** The altar fills the bottom of the stage; its tray top is where things rest. */
export const ALTAR = { x: 0, y: STAGE.h - Math.round(124 * ART), w: STAGE.w, h: Math.round(124 * ART) } as const;
const TRAY = ALTAR.y + 68 * ART;
/** The tube stands at the centre of the tray (its foot at y 136 of its 80 x 140 art). */
export const TUBE = { w: Math.round(80 * ART), h: Math.round(140 * ART), x: STAGE.w / 2 - Math.round(80 * ART) / 2, y: Math.round(TRAY - 136 * ART) } as const;
/** Shake pivot: the foot of the tube (40, 134 on the art), as a CSS transform-origin. */
export const TUBE_PIVOT = `50% ${Math.round((134 / 140) * 100)}%`;
/** Centre of the tube mouth: every stick leaves from here. */
export const MOUTH = { x: STAGE.w / 2, y: Math.round(TUBE.y + 44 * ART) } as const;
/** Stick art ratio (18 x 110). */
export const STICK_RATIO = 18 / 110;

/** Altar art rows hidden while a x10 fans out: the offerings above the tray step aside with the tube. */
export const TRAY_TOP = Math.round(TRAY - ALTAR.y - 2);

/**
 * Where a stick rests: centre (x, y) and box (w x h) before rotation, rotation in degrees around `pivot`, drawn stick
 * height, and the touch area: the top `hit` px of the box.
 */
export type Slot = { x: number; y: number; w: number; h: number; rotate: number; stickH: number; pivot: "center" | "bottom"; hit: number };

const ROW = 5;
const PITCH = 44;
const FAN_STEP = 4;
const FRONT_H = 92;
/** The back row stands taller so its tips (44 px of touch target) rise above the front row. */
const BACK_H = FRONT_H + 44;

/**
 * Resting places. One stick lies across the tray in front of the tube. More stand on the cleared tray in a fan of two
 * staggered rows of five (back row taller), each leaning out from its foot.
 */
export function slotsFor(count: number): Slot[] {
  if (count === 1) return [{ x: 104, y: Math.round(TRAY - 8), w: 44, h: 124, rotate: -84, stickH: 120, pivot: "center", hit: 124 }];
  const rows = Math.ceil(count / ROW);
  const foot = Math.round(TRAY + 2);
  return Array.from({ length: count }, (_, i) => {
    const r = Math.floor(i / ROW);
    const inRow = Math.min(ROW, count - r * ROW);
    const j = i - r * ROW;
    const back = rows > 1 && r < rows - 1;
    const offset = rows === 1 ? 0 : back ? -PITCH / 4 : PITCH / 4;
    const k = j - (inRow - 1) / 2;
    const h = back ? BACK_H : FRONT_H;
    // The back row only takes touches on its tip: the front row covers the rest of it.
    return { x: STAGE.w / 2 + k * PITCH + offset, y: foot - h / 2, w: 44, h, rotate: k * FAN_STEP, stickH: h - 4, pivot: "bottom", hit: back ? BACK_H - FRONT_H + 4 : h };
  });
}

/** Recap order (indices into the pull): new pieces first, then rarest first, then draw order. */
export function recapOrder(items: readonly GachaPullItem[]): number[] {
  const rank = (i: GachaPullItem) => RARITY_ORDER.indexOf(i.rarity);
  return items
    .map((it, i) => ({ it, i }))
    .sort((a, b) => Number(a.it.duplicate) - Number(b.it.duplicate) || rank(b.it) - rank(a.it) || a.i - b.i)
    .map((x) => x.i);
}

// --- The sequence ---

export type RevealPhase = "tube" | "shaking" | "falling" | "altar" | "hold" | "scroll" | "recap";

export type RevealState = {
  readonly items: readonly GachaPullItem[];
  phase: RevealPhase;
  /** Shake cycle being played (0-based). */
  shake: number;
  /** The finger is still on the tube. */
  held: boolean;
  /** The stick being read (hold / scroll). */
  current: number | null;
  /** Sticks already read (or skipped to the recap). */
  revealed: boolean[];
  /** Confetti bursts fired: 0 or 1, never more (the first legendary unroll). */
  burst: number;
};

export type RevealAction =
  | { type: "press" }
  | { type: "release" }
  | { type: "shakeEnd" }
  | { type: "fallen" }
  | { type: "open"; index: number }
  | { type: "holdEnd" }
  | { type: "close" }
  | { type: "revealAll" }
  | { type: "skip" };

/** `direct`: reduced motion or a recovered pull (already drawn: nothing to shake), straight to the recap. */
export function initialReveal(items: readonly GachaPullItem[], opts: { direct: boolean }): RevealState {
  return {
    items,
    phase: opts.direct ? "recap" : "tube",
    shake: 0,
    held: false,
    current: null,
    revealed: items.map(() => opts.direct),
    burst: 0,
  };
}

export function revealReducer(s: RevealState, a: RevealAction): RevealState {
  switch (a.type) {
    case "press":
      return s.phase === "tube" ? { ...s, phase: "shaking", shake: 0, held: true } : s;
    case "release":
      return s.held ? { ...s, held: false } : s;
    case "shakeEnd":
      if (s.phase !== "shaking") return s;
      return s.held && s.shake + 1 < REVEAL.maxShakes ? { ...s, shake: s.shake + 1 } : { ...s, phase: "falling", held: false };
    case "fallen":
      return s.phase === "falling" ? { ...s, phase: "altar" } : s;
    case "open": {
      const it = s.items[a.index];
      if (s.phase !== "altar" || !it) return s;
      const hold = it.rarity === "legendary" && s.revealed[a.index] !== true;
      return { ...s, phase: hold ? "hold" : "scroll", current: a.index, revealed: s.revealed.map((r, i) => r || i === a.index) };
    }
    case "holdEnd":
      return s.phase === "hold" ? { ...s, phase: "scroll", burst: 1 } : s;
    case "close":
      if (s.phase !== "scroll") return s;
      return { ...s, phase: s.revealed.every(Boolean) ? "recap" : "altar", current: null };
    case "revealAll":
    case "skip":
      return s.phase === "recap" ? s : { ...s, phase: "recap", held: false, current: null, revealed: s.items.map(() => true) };
  }
}
