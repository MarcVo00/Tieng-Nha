import type { SoundCue } from "@/domain/sound";
import { duration } from "@/ui/motion";

// L'épée du dragon (spec more-banners §4.4) as data: one pure schedule for the beats, the sounds and the path of each
// piece of the ink dragon. Beats are composed from the motion tokens; positions are constants of the focus view (no DOM
// measure during the scene). The component only reads this.

/** The focus view the signature fills: the 256 x 264 paper stage of the reveal (a test keeps it equal to `STAGE`). */
export const BOX = { w: 256, h: 264 } as const;
/**
 * The sword standing on the altar tray (ink-dragon-blade.svg is 40 x 180, drawn 1:1): the pearl in its flame on top,
 * the point at 20 of the art, the guard at 112–131, its tassel over the front of the tray.
 */
export const BLADE = { w: 40, h: 180, x: (BOX.w - 40) / 2, y: 34, tipY: 34 + 20 } as const;
const AXIS = BLADE.x + BLADE.w / 2;
/** Where the dragon is born: the ink pooled on the altar tray, at the foot of the sword. */
export const POOL = { x: AXIS, y: 206, w: 150, h: 40 } as const;
/** The lit veins, in three bands of the blade art from the point down to the guard (art px). */
export const VEIN_BANDS = [
  { top: 0, h: 64 },
  { top: 64, h: 54 },
  { top: 118, h: 62 },
] as const;
/** The dragon: its head, ten pieces of body, its tail (each piece an element: ≤ 12 per scene). */
export const SEGMENTS = 12;
/**
 * The coil: a rising helix round the sword, flattened (ry = rx · FLAT) so the pass in front is low and the pass behind
 * high. It springs out wide from the pool, then tightens as it climbs towards the point.
 */
const COIL = { cyFrom: 200, cyTo: 78, rxStart: 12, rxWide: 100, rxTo: 52, flat: 0.3, open: 0.12, turns: 1.25 } as const;
/** Depth cues: scale of a piece at the back (-1) and the front (+1) of the coil, and its opacity behind. */
const DEPTH = { back: 0.68, front: 1.15, dim: 0.65 } as const;
/** Behind the sword: a piece whose centre is this close to its axis is hidden by the blade. */
const BEHIND = 22;
/** How dark the card gets: a storm over the altar (the black ink must still read on it). */
export const DARK = 0.55;

/** Beats in seconds from the start of the signature (≈ 3.8 s in all). */
export const SIG = (() => {
  const darken = duration.slow; // the card darkens, the sword waits on the altar
  const rise = duration.base; // the dragon rises out of the ink on the tray, roaring
  const coil = duration.loop + duration.slow + duration.base; // one and a quarter turns round the sword
  const dive = duration.slow; // up over the point, and down onto it
  const plunge = duration.base; // into the blade, swallowed by it
  const lag = duration.base / 5; // each piece follows the one before it along the same path
  const headTip = rise + coil + dive;
  const ring = headTip + plunge + (SEGMENTS - 1) * lag; // the tail is in: the blade rings
  const flare = duration.slow + duration.base; // the blade blazes and the dark lifts
  return {
    darken,
    rise,
    coil,
    dive,
    plunge,
    lag,
    /** The head reaches the point of the blade: the first veins light. */
    headTip,
    /** The whole dragon is inside the blade: the metallic ring, the flare. */
    ring,
    /** The scroll takes over as the flare fades: no empty beat between the ring and the sword. */
    end: ring + flare,
  } as const;
})();

export type SignatureCue = { at: number; cue: SoundCue };

/** The sounds of the scene: the roar as the dragon rises, the ring of the blade. */
export function dragonCues(): SignatureCue[] {
  return [
    { at: SIG.rise, cue: "sig.roar" },
    { at: SIG.ring, cue: "sig.blade" },
  ];
}

/** What is on screen: mounted between `from` and `to` (seconds), unmounted outside. */
export type Beat = "blade" | "pool" | "dragon" | "veins" | "flare";

export type Span = { delay: number; length: number };

/**
 * Every animation of the scene, in seconds from its start. The component takes its delays and lengths from here (each
 * relative to its element's mount), so the budget below counts what is actually animated.
 */
export const FX = {
  /** The ink overlay: it spreads, then lifts at the ring. */
  darken: { delay: 0, length: SIG.darken },
  lift: { delay: SIG.ring, length: duration.slow },
  /** The sword appears on the altar. */
  bladeIn: { delay: 0, length: SIG.darken },
  /** The ink pooled on the tray: it spreads as the dragon rises out of it, and is gone once it has left. */
  pool: { delay: SIG.rise, length: duration.celebrate },
  /** One piece of the dragon: the whole flight, from the pool to inside the blade. */
  flight: { delay: SIG.rise, length: SIG.ring - SIG.rise },
  /** The dive itself (the head leaves the coil). */
  dive: { delay: SIG.rise + SIG.coil, length: SIG.dive + SIG.plunge },
  /** Vein band `i` lights, from the point down, as the dragon pours in; the last as it rings. */
  vein: (i: number): Span => {
    const step = (SIG.ring - duration.base - SIG.headTip) / (VEIN_BANDS.length - 1);
    return { delay: SIG.headTip + i * step, length: duration.base };
  },
  /** The ring: the blade pulses and fades out as the scroll comes. */
  fade: { delay: SIG.ring, length: SIG.end - SIG.ring },
  /** The flare of gold behind the blade. */
  glow: { delay: SIG.ring, length: SIG.end - SIG.ring },
} as const;

export const MOUNTED: Readonly<Record<Beat, { from: number; to: number }>> = {
  blade: { from: 0, to: SIG.end },
  pool: { from: duration.instant, to: FX.pool.delay + FX.pool.length },
  // The pool and the dragon's pieces land on frames of their own after the card opens, so neither weighs on the open
  // (4x CPU: no 50 ms frame).
  dragon: { from: duration.instant * 2, to: SIG.ring },
  veins: { from: FX.vein(0).delay, to: SIG.end },
  flare: { from: SIG.ring, to: SIG.end },
};

/** Every animated element's span (for the budget: ≤ 16 animated at once, signature exception of audit §D). */
export function animatedSpans(): Span[] {
  return [
    FX.darken,
    FX.lift,
    FX.bladeIn,
    FX.pool,
    ...Array.from({ length: SEGMENTS }, () => FX.flight),
    ...VEIN_BANDS.map((_, i) => FX.vein(i)),
    FX.fade,
    FX.glow,
  ];
}

/** Drawn size (px) of piece `k`: the head, the body tapering to the tail. */
export function segmentSize(k: number): { w: number; h: number } {
  if (k === 0) return { w: 48, h: 34 };
  if (k === SEGMENTS - 1) return { w: 34, h: 24 };
  const t = 1 - ((k - 1) / (SEGMENTS - 2)) * 0.34;
  return { w: Math.round(40 * t), h: Math.round(28 * t) };
}

export type DragonPath = {
  x: number[];
  y: number[];
  /** Heading, degrees (applied before `scaleY`, see the component's transform). */
  rotate: number[];
  scale: number[];
  /** -1..1: the head and the tail roll over so their crest stays up whichever way they go. 1 for the body. */
  scaleY: number[];
  opacity: number[];
  /** Keyframe offsets, 0..1 over the flight (`SIG.rise` → `SIG.ring`). */
  times: number[];
};

type Pose = { x: number; y: number; scale: number; opacity: number };

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const round = (n: number) => Math.round(n * 10) / 10;

/** The coil's end, and the dive from it over the point of the blade and down onto it (a cubic, arriving straight down). */
const COIL_END = { x: AXIS - COIL.rxTo, y: COIL.cyTo } as const;
const DIVE = [COIL_END, { x: COIL_END.x, y: 20 }, { x: AXIS, y: 0 }, { x: AXIS, y: BLADE.tipY }] as const;
const SWALLOWED = { y: BLADE.tipY + 70, scale: 0.55 } as const;
const bezier = (a: number, b: number, c: number, d: number, t: number) =>
  (1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t ** 2 * c + t ** 3 * d;

/** Where the head is `tau` seconds after it rises out of the pool (the other pieces follow the same path, later). */
function headAt(tau: number): Pose {
  if (tau < SIG.coil) {
    // Before it rises it waits, unseen, at the start of the coil (in the pool).
    const u = Math.max(0, tau) / SIG.coil;
    const rx = u < COIL.open ? lerp(COIL.rxStart, COIL.rxWide, 1 - (1 - u / COIL.open) ** 2) : lerp(COIL.rxWide, COIL.rxTo, (u - COIL.open) / (1 - COIL.open));
    const ry = rx * COIL.flat;
    const cy = lerp(COIL.cyFrom, COIL.cyTo, u);
    const theta = Math.PI / 2 + u * COIL.turns * Math.PI * 2;
    const x = AXIS + rx * Math.cos(theta);
    const y = cy + ry * Math.sin(theta);
    const depth = Math.sin(theta); // 1 in front of the sword, -1 behind it
    const near = (depth + 1) / 2;
    const born = clamp01(tau / duration.fast); // it rises out of the ink
    let opacity = DEPTH.dim + (1 - DEPTH.dim) * Math.min(1, near * 1.6);
    // Behind the blade: hidden by it.
    if (depth < 0 && Math.abs(x - AXIS) < BEHIND && y > BLADE.tipY - 10) opacity *= 0.1;
    return { x, y, scale: lerp(0.3, DEPTH.back + (DEPTH.front - DEPTH.back) * near, born), opacity: opacity * born };
  }
  if (tau < SIG.coil + SIG.dive) {
    const t = (tau - SIG.coil) / SIG.dive;
    const [a, b, c, d] = DIVE;
    return { x: bezier(a.x, b.x, c.x, d.x, t), y: bezier(a.y, b.y, c.y, d.y, t), scale: lerp(0.85, 1, t), opacity: 1 };
  }
  // Into the blade: it plunges, faster and faster, shrinking and swallowed.
  const t = clamp01((tau - SIG.coil - SIG.dive) / SIG.plunge);
  const e = t * t;
  return { x: AXIS, y: lerp(BLADE.tipY, SWALLOWED.y, e), scale: lerp(1, SWALLOWED.scale, e), opacity: 1 - e };
}

const SAMPLES = 60;

/**
 * The flight of piece `k` (0 the head, `SEGMENTS - 1` the tail): out of the pool, one and a quarter turns rising round
 * the sword (big and dark in front, small, faint and hidden by the blade behind it), up over the point and down into
 * the blade where it is swallowed, `k` lags after the head.
 */
export function dragonPath(k: number): DragonPath {
  const flight = FX.flight.length;
  const rolls = k === 0 || k === SEGMENTS - 1;
  const out: DragonPath = { x: [], y: [], rotate: [], scale: [], scaleY: [], opacity: [], times: [] };
  let heading: number | null = null;
  let side = 1;
  for (let i = 0; i <= SAMPLES; i++) {
    const t = i / SAMPLES;
    const tau = t * flight - k * SIG.lag;
    const p = headAt(tau);
    // Heading along the path (finite difference), unwrapped so it never spins the long way round.
    const ahead = headAt(Math.max(tau, 0) + 0.01);
    const behind = headAt(Math.max(tau, 0.01) - 0.01);
    const dx = ahead.x - behind.x;
    const dy = ahead.y - behind.y;
    let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (Math.hypot(dx, dy) < 1e-6) angle = heading ?? 180;
    if (heading !== null) {
      while (angle - heading > 180) angle -= 360;
      while (angle - heading < -180) angle += 360;
    }
    heading = angle;
    // Going left, the head would hang upside down: it rolls over (its crest stays up), edge-on only while it climbs.
    const vx = dx / (Math.hypot(dx, dy) || 1);
    if (Math.abs(vx) > 0.05) side = Math.sign(vx);
    const roll = rolls ? side * Math.max(0.35, Math.min(1, Math.abs(vx) * 3)) : 1;
    out.times.push(Math.round(t * 1000) / 1000);
    out.x.push(round(p.x));
    out.y.push(round(p.y));
    out.rotate.push(round(angle));
    out.scale.push(Math.round(p.scale * 100) / 100);
    out.scaleY.push(Math.round(roll * 100) / 100);
    out.opacity.push(Math.round(p.opacity * 100) / 100);
  }
  return out;
}
