import type { SoundCue } from "@/domain/sound";
import { duration } from "@/ui/motion";

// L'épée du dragon (spec more-banners §4.4) as data: one pure schedule for the beats, the sounds, the path of each piece
// of the ink dragon and of the slice of blade that hides it when it passes behind. Beats are composed from the motion
// tokens; positions are constants of the focus view (no DOM measure during the scene). The component only reads this.

/** The focus view the signature fills: the 256 x 264 paper stage of the reveal (a test keeps it equal to `STAGE`). */
export const BOX = { w: 256, h: 264 } as const;
/**
 * The sword standing on the altar tray (ink-dragon-blade.svg is 40 x 180, drawn 1:1): the pearl in its flame on top,
 * the point at 20 of the art, the blade 18 px wide, the guard at 112–131, its tassel over the front of the tray.
 */
export const BLADE = { w: 40, h: 180, x: (BOX.w - 40) / 2, y: 34, tipY: 34 + 20, half: 9 } as const;
export const AXIS = BLADE.x + BLADE.w / 2;
/** Where the dragon is born: ink splashed on the altar tray, at the foot of the sword. */
export const POOL = { x: AXIS, y: 206, w: 116, h: 40 } as const;
/** The lit veins, in three bands of the blade art from the point down to the guard (art px). */
export const VEIN_BANDS = [
  { top: 0, h: 64 },
  { top: 64, h: 54 },
  { top: 118, h: 62 },
] as const;
/** The dragon: its head, ten pieces of body, its tail (each piece an element: ≤ 12 per scene). */
export const SEGMENTS = 12;
/**
 * The coil: one turn of a rising helix hugging the sword. It starts at the left of the blade, low on the tray, springs
 * out of the ink, passes behind the blade, comes round in front of it higher up and ends at the left again, near the
 * point, where it dives. The climb between the pass behind and the pass in front keeps them apart in height, so the
 * slice of blade that hides the pass behind never hides the pass in front.
 */
const COIL = { cyFrom: 210, cyTo: 50, rxStart: 26, rxWide: 50, rxTo: 30, flat: 0.45, open: 0.2, turns: 1, from: Math.PI } as const;
/** How much of a turn the body wraps at once (head to tail): it visibly coils round the sword. */
export const BODY_TURNS = 0.78;
/** Depth: the scale of a piece at the back (-1) and the front (+1) of the coil. The ink stays solid black all round. */
const DEPTH = { back: 0.78, front: 1.12 } as const;
/** How dark the card gets: a storm over the altar (the black ink must still read on it, the gold must blaze). */
export const DARK = 0.6;

/** Beats in seconds from the start of the signature (≈ 3.7 s in all). */
export const SIG = (() => {
  const darken = duration.slow; // the card darkens, the sword waits on the altar
  const rise = duration.base; // the dragon rises out of the ink on the tray, roaring
  const coil = duration.loop; // one turn round the sword (the head's)
  const dive = duration.slow; // up over the point, and down onto it
  const plunge = duration.base; // into the blade, swallowed by it
  const lag = (coil * BODY_TURNS) / COIL.turns / (SEGMENTS - 1); // each piece follows the one before along the same path
  const headTip = rise + coil + dive;
  const ring = headTip + plunge + (SEGMENTS - 1) * lag; // the tail is in: the blade rings
  const blaze = duration.base; // the glow swells to its peak, on the dark
  const lift = duration.slow; // then the dark lifts round the blazing sword
  const handOver = duration.fast; // the sword gives way to the scroll
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
    /** The glow at its peak: until then the dark holds. */
    blazed: ring + blaze,
    /** The dark has lifted; the lit sword is still whole. */
    lifted: ring + blaze + lift,
    /** The sword has given way: the scroll takes over (no empty beat). */
    end: ring + blaze + lift + handOver,
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
export type Beat = "blade" | "pool" | "dragon" | "occluder" | "veins" | "flare";

export type Span = { delay: number; length: number };

/**
 * Every animation of the scene, in seconds from its start. The component takes its delays and lengths from here (each
 * relative to its element's mount), so the budget below counts what is actually animated.
 */
export const FX = {
  /** The ink overlay: it spreads, holds through the ring, then lifts once the glow has peaked (one element, two spans
   * that never overlap, so it counts once at any time). */
  darken: { delay: 0, length: SIG.darken },
  lift: { delay: SIG.blazed, length: SIG.lifted - SIG.blazed },
  /** The sword appears on the altar. */
  bladeIn: { delay: 0, length: SIG.darken },
  /** The ink splashed on the tray: it spreads as the dragon rises out of it, and is gone once its tail has left. */
  pool: { delay: SIG.rise, length: duration.celebrate + (SEGMENTS - 1) * SIG.lag }, // until the tail has risen out of it
  /** The head's whole flight, from the pool to inside the blade. */
  flight: { delay: SIG.rise, length: SIG.ring - SIG.rise },
  /**
   * Piece `k`'s flight: from the moment it rises out of the pool (it waits unseen before), so the twelve start on
   * different frames rather than all at once (4x CPU), to inside the blade with the tail.
   */
  piece: (k: number): Span => ({ delay: SIG.rise + k * SIG.lag, length: SIG.ring - SIG.rise - k * SIG.lag }),
  /** The slice of blade drawn over the dragon where it passes behind (two elements: the slice and the art in it). */
  occluder: { delay: SIG.darken, length: SIG.headTip - SIG.darken },
  /** Vein band `i` lights, from the point down, as the dragon pours in; the last as it rings. */
  vein: (i: number): Span => {
    const step = (SIG.ring - duration.base - SIG.headTip) / (VEIN_BANDS.length - 1);
    return { delay: SIG.headTip + i * step, length: duration.base };
  },
  /** The ring: the lit blade swells, holds whole while the dark lifts, then gives way to the scroll. */
  fade: { delay: SIG.ring, length: SIG.end - SIG.ring },
  /** The flare of gold behind the blade: it swells on the dark, then fades with it. */
  glow: { delay: SIG.ring, length: SIG.end - SIG.ring },
} as const;

export const MOUNTED: Readonly<Record<Beat, { from: number; to: number }>> = {
  blade: { from: 0, to: SIG.end },
  // Every part lands on a frame of its own, away from the card opening and from any other mount or start, so no frame
  // carries two of them (4x CPU): the pool, the dragon's pieces, the occluder when it starts, the veins mid-coil, well
  // before they light.
  pool: { from: duration.instant, to: FX.pool.delay + FX.pool.length },
  dragon: { from: duration.instant * 2, to: SIG.ring },
  occluder: { from: FX.occluder.delay, to: FX.occluder.delay + FX.occluder.length },
  veins: { from: SIG.rise + SIG.coil / 2, to: SIG.end },
  flare: { from: SIG.ring, to: SIG.end },
};

/** Every animated element's span (for the budget: ≤ 16 animated at once, signature exception of audit §D). */
export function animatedSpans(): Span[] {
  return [
    FX.darken,
    FX.lift,
    FX.bladeIn,
    FX.pool,
    ...Array.from({ length: SEGMENTS }, (_, k) => FX.piece(k)),
    FX.occluder,
    FX.occluder,
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

type Pose = { x: number; y: number; scale: number; opacity: number; /** 1 in front of the sword, -1 behind it. */ depth: number; /** 1, or less as it squeezes into the blade. */ squeeze: number };

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const round = (n: number) => Math.round(n * 10) / 10;

/** The coil's end (left of the blade, near the point), and the dive from it over the point and down onto it. */
const COIL_END = { x: AXIS - COIL.rxTo, y: COIL.cyTo } as const;
const DIVE = [COIL_END, { x: COIL_END.x, y: 18 }, { x: AXIS, y: 2 }, { x: AXIS, y: BLADE.tipY }] as const;
const SWALLOWED = { y: BLADE.tipY + 70, scale: 0.55, squeeze: 0.4 } as const;
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
    const theta = COIL.from + u * COIL.turns * Math.PI * 2;
    const depth = Math.sin(theta);
    const near = (depth + 1) / 2;
    const born = clamp01(tau / duration.instant); // it rises out of the ink, solid at once
    return {
      x: AXIS + rx * Math.cos(theta),
      y: cy + ry * depth,
      scale: lerp(0.6, DEPTH.back + (DEPTH.front - DEPTH.back) * near, born),
      opacity: born,
      depth,
      squeeze: 1,
    };
  }
  if (tau < SIG.coil + SIG.dive) {
    const t = (tau - SIG.coil) / SIG.dive;
    const [a, b, c, d] = DIVE;
    return { x: bezier(a.x, b.x, c.x, d.x, t), y: bezier(a.y, b.y, c.y, d.y, t), scale: lerp(0.85, 1, t), opacity: 1, depth: 1, squeeze: 1 };
  }
  // Into the blade: it narrows to the blade's width at once, then plunges faster and faster, shrinking and swallowed.
  const t = clamp01((tau - SIG.coil - SIG.dive) / SIG.plunge);
  const e = t * t;
  return {
    x: AXIS,
    y: lerp(BLADE.tipY, SWALLOWED.y, e),
    scale: lerp(1, SWALLOWED.scale, e),
    opacity: 1 - e,
    depth: 1,
    squeeze: lerp(1, SWALLOWED.squeeze, Math.min(1, t * 3)),
  };
}

/** Piece `k` at `at` seconds from the start of the scene. */
const pieceAt = (k: number, at: number): Pose => headAt(at - SIG.rise - k * SIG.lag);

const SAMPLES = 60;
/** Keyframes per second, shared by the pieces and the occluder. */
const RATE = SAMPLES / FX.flight.length;

export type DragonPath = {
  x: number[];
  y: number[];
  /** Heading, degrees (applied before `scaleY`, see the component's transform). */
  rotate: number[];
  scale: number[];
  /**
   * Across the piece: the head and the tail roll over so their crest stays up whichever way they go (-1..1); every
   * piece narrows to the blade's width as it plunges into it.
   */
  scaleY: number[];
  opacity: number[];
  /** Keyframe offsets, 0..1 over the piece's own flight (`FX.piece(k)`). */
  times: number[];
};

/**
 * The flight of piece `k` (0 the head, `SEGMENTS - 1` the tail): out of the pool, one turn rising round the sword (big
 * in front, smaller behind, solid ink all round), up over the point and down into the blade where it is swallowed,
 * `k` lags after the head.
 */
export function dragonPath(k: number): DragonPath {
  const flight = FX.piece(k).length;
  const rolls = k === 0 || k === SEGMENTS - 1;
  const out: DragonPath = { x: [], y: [], rotate: [], scale: [], scaleY: [], opacity: [], times: [] };
  let heading: number | null = null;
  let side = 1;
  for (let i = 0; i <= SAMPLES; i++) {
    const t = i / SAMPLES;
    const tau = t * flight;
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
    out.scaleY.push(Math.round(roll * p.squeeze * 100) / 100);
    out.opacity.push(Math.round(p.opacity * 100) / 100);
  }
  return out;
}

/** The occluder: a slice of the blade art this tall, drawn over the dragon. */
export const SLICE_H = 30;
/** A piece behind the sword whose centre is this close to its axis is under the blade (its half-width at the back, plus the blade's). */
const UNDER = 24;

export type OccluderPath = {
  /** Top of the slice in the stage (the art inside it moves by the opposite, so it stays exactly over the blade). */
  y: number[];
  opacity: number[];
  /** Keyframe offsets, 0..1 over `FX.occluder`. */
  times: number[];
};

/**
 * Where the slice of blade sits over time: on the piece passing behind the sword nearest its axis, shown only then (and
 * never while a piece in front crosses the same slice). It is the blade's own art at the blade's own place, so where no
 * ink is under it, it changes nothing on screen.
 */
export function occluderPath(): OccluderPath {
  const { delay, length } = FX.occluder;
  const n = Math.max(1, Math.round(length * RATE));
  const out: OccluderPath = { y: [], opacity: [], times: [] };
  let top = BLADE.tipY;
  for (let i = 0; i <= n; i++) {
    const at = delay + (i / n) * length;
    const pieces = Array.from({ length: SEGMENTS }, (_, k) => pieceAt(k, at)).filter((p) => p.opacity > 0.05);
    const under = pieces.filter((p) => p.depth < 0 && Math.abs(p.x - AXIS) < UNDER).sort((a, b) => Math.abs(a.x - AXIS) - Math.abs(b.x - AXIS))[0];
    let shown = 0;
    if (under) {
      const next = Math.round(under.y - SLICE_H / 2);
      // A piece in front whose body lies over the blade in the same band: the slice would cut it, so it stays off (the
      // climb keeps the two passes apart, so this is rare and brief; a front piece only grazing the blade with its snout
      // does not count).
      const crossed = pieces.some((p) => p.depth >= 0 && Math.abs(p.x - AXIS) < BLADE.half + 8 && p.y + 12 > next && p.y - 12 < next + SLICE_H);
      if (!crossed) {
        top = next;
        shown = 1;
      }
    }
    out.times.push(Math.round((i / n) * 1000) / 1000);
    out.y.push(top);
    out.opacity.push(shown);
  }
  return out;
}

/** Test helper: piece `k` at `at` s, with its depth (1 in front of the sword, -1 behind). */
export function poseAt(k: number, at: number): { x: number; y: number; depth: number; opacity: number } {
  const p = pieceAt(k, at);
  return { x: p.x, y: p.y, depth: p.depth, opacity: p.opacity };
}
