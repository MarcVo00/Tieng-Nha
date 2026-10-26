import type { SoundCue } from "@/domain/sound";
import { duration } from "@/ui/motion";

// La gardienne des talismans (spec sound-and-reveal §6.2) as data: one pure schedule for the beats, the sounds and the
// path of each talisman. Beats are composed from the motion tokens; positions are constants of the focus view (no DOM
// measure during the scene). The component only reads this.

/** The focus view the signature fills: the 256 x 264 paper stage of the reveal (a test keeps it equal to `STAGE`). */
export const BOX = { w: 256, h: 264 } as const;
/** Drawn size of one talisman (talisman.svg is 24 x 52). */
export const TALISMAN = { w: 22, h: Math.round((22 * 52) / 24) } as const;
export const TALISMAN_COUNT = 12;
/** The ink silhouette (ink-silhouette.svg is 120 x 160), centred above the altar. */
export const SILHOUETTE = { w: 138, h: 184, x: (BOX.w - 138) / 2, y: 22 } as const;
/** Where the talismans are torn from: a small stack of paper lying on the altar tray. */
const TRAY = { x: BOX.w / 2, y: 194 } as const;
/**
 * The vortex: a deep, slightly tilted ellipse that rises from the altar and tightens while it turns, so the papers in
 * front are big and bright and those behind small and dim.
 */
const VORTEX = { cx: BOX.w / 2, cyFrom: 180, cyTo: 92, rxFrom: 104, rxTo: 64, ryFrom: 56, ryTo: 34, tilt: -0.17, turns: 1.5 } as const;
/** Depth cues: scale and opacity of a talisman at the back (-1) and the front (+1) of the vortex. */
const DEPTH = { back: 0.6, front: 1.15, dim: 0.5 } as const;
/** How dark the card gets. */
export const DARK = 0.78;

/** Beats in seconds from the start of the signature (≈ 3 s in all). */
export const SIG = (() => {
  const darken = duration.slow; // the card darkens: ink spreads over the paper
  const wind = duration.base; // the gust tears the talismans off the altar
  const swirl = duration.loop + duration.slow + duration.base + duration.fast; // they whirl around the altar
  const converge = duration.slow + duration.fast; // they close in on the silhouette
  const firstSeal = wind + duration.slow;
  const sealStep = duration.instant * 1.5; // 120 ms: well past the 50 ms dedupe of a cue
  const convergeAt = wind + swirl;
  const gong = convergeAt + converge;
  const burst = duration.slow; // the blot spreads, holds as solid ink, and fades as she takes over
  return {
    darken,
    wind,
    /** The talismans fly from `wind` to `gong`: the gust, the vortex, then the convergence. */
    swirl,
    converge,
    convergeAt,
    firstSeal,
    sealStep,
    /** One seal catching fire. */
    sealFlash: duration.base,
    /** The silhouette inks in while the talismans close on it. */
    silhouetteAt: convergeAt + duration.fast,
    silhouetteIn: duration.slow,
    /** The last gong: she dissolves into the ink, which bursts like a blot on the paper while the dark lifts. */
    gong,
    burst,
    /** The scroll takes over as the last of the ink fades: no empty beat between the gong and her. */
    end: gong + burst,
  } as const;
})();

/** When seal `i` (0-based) catches fire. */
export const sealAt = (i: number): number => SIG.firstSeal + i * SIG.sealStep;

export type SignatureCue = { at: number; cue: SoundCue };

/** The sounds of the scene, in order: the wind, one brush stroke per seal, the gong. */
export function talismanCues(): SignatureCue[] {
  return [
    { at: SIG.wind, cue: "sig.wind" },
    ...Array.from({ length: TALISMAN_COUNT }, (_, i): SignatureCue => ({ at: sealAt(i), cue: "sig.brush" })),
    { at: SIG.gong, cue: "sig.gong" },
  ];
}

/** What is on screen: mounted between `from` and `to` (seconds), unmounted outside. */
export type Beat = "talismans" | "silhouette" | "splash";
export const MOUNTED: Readonly<Record<Beat, { from: number; to: number }>> = {
  // The paper stack lands a frame after the card opens: the open itself stays one light frame (4x CPU).
  talismans: { from: duration.instant, to: SIG.gong },
  silhouette: { from: SIG.silhouetteAt, to: SIG.end },
  splash: { from: SIG.gong, to: SIG.end },
};

export type Span = { delay: number; length: number };

/**
 * Every animation of the scene, in seconds from its start. The component takes its delays and lengths from here (each
 * relative to its element's mount), so the budget below counts what is actually animated.
 */
export const FX = {
  /** The ink overlay: it spreads, then lifts at the gong. */
  darken: { delay: 0, length: SIG.darken },
  lift: { delay: SIG.gong, length: duration.slow },
  /** One talisman's whole flight. */
  flight: { delay: SIG.wind, length: SIG.gong - SIG.wind },
  seal: (i: number): Span => ({ delay: sealAt(i), length: SIG.sealFlash }),
  silhouetteIn: { delay: SIG.silhouetteAt, length: SIG.silhouetteIn },
  /** She dissolves fast, the blot underneath already spreading, so no torn piece of her gold rim is ever left. */
  silhouetteOut: { delay: SIG.gong, length: duration.fast },
  /** The blot: it spreads (scale) and holds as solid ink, then fades fast as she takes over (never a grey haze). */
  blotGrow: { delay: SIG.gong, length: SIG.burst },
  blotFade: { delay: SIG.gong + duration.base, length: SIG.burst - duration.base },
} as const;

/** Every animated element's span (for the budget: ≤ 16 animated at once, signature exception of audit §D). */
export function animatedSpans(): Span[] {
  return [
    FX.darken,
    FX.lift,
    ...Array.from({ length: TALISMAN_COUNT }, () => FX.flight),
    ...Array.from({ length: TALISMAN_COUNT }, (_, i) => FX.seal(i)),
    FX.silhouetteIn,
    FX.silhouetteOut,
    FX.blotGrow, // one element: its fade runs within its growth
  ];
}

export type TalismanPath = {
  x: number[];
  y: number[];
  rotate: number[];
  scale: number[];
  opacity: number[];
  /** Keyframe offsets, 0..1 over the flight (`SIG.wind` → `SIG.gong`). */
  times: number[];
};

/** Points of the silhouette (fractions of its box) the talismans melt into: bun, head, shoulders, sleeves, robe. */
const SILHOUETTE_POINTS = [
  { x: 0.5, y: 0.26 },
  { x: 0.33, y: 0.4 },
  { x: 0.67, y: 0.4 },
  { x: 0.25, y: 0.62 },
  { x: 0.75, y: 0.62 },
  { x: 0.42, y: 0.66 },
  { x: 0.58, y: 0.66 },
  { x: 0.5, y: 0.44 },
  { x: 0.38, y: 0.82 },
  { x: 0.62, y: 0.82 },
  { x: 0.13, y: 0.68 },
  { x: 0.87, y: 0.68 },
] as const;

const ORBIT_STEPS = 24;
const round = (n: number) => Math.round(n * 10) / 10;

/**
 * The flight of talisman `i`: lying on the altar, torn off by the gust, whirled one and a half turns in a rising,
 * tightening vortex (big and bright in front, small and dim behind, tumbling end over end), then drawn into the
 * silhouette where it melts.
 */
export function talismanPath(i: number): TalismanPath {
  const flight = FX.flight.length;
  const tOrbit = SIG.swirl / flight;
  const tGust = 0.1; // the gust: from the altar to its place on the ring
  const phase = (i / TALISMAN_COUNT) * Math.PI * 2;
  const spin = i % 2 === 0 ? 1 : -1; // half tumble one way, half the other
  const x: number[] = [];
  const y: number[] = [];
  const rotate: number[] = [];
  const scale: number[] = [];
  const opacity: number[] = [];
  const times: number[] = [];
  const push = (t: number, px: number, py: number, r: number, s: number, o: number) => {
    times.push(round(t * 1000) / 1000);
    x.push(round(px));
    y.push(round(py));
    rotate.push(round(r));
    scale.push(round(s * 100) / 100);
    opacity.push(o);
  };
  // On the altar: a small untidy stack of paper lying flat.
  const fan = i - (TALISMAN_COUNT - 1) / 2;
  const lying = 90 + fan * 3;
  push(0, TRAY.x + fan * 3, TRAY.y - (i % 3), lying, 0.7, 1);
  const cos = Math.cos(VORTEX.tilt);
  const sin = Math.sin(VORTEX.tilt);
  let last = lying;
  for (let k = 0; k <= ORBIT_STEPS; k++) {
    const u = k / ORBIT_STEPS;
    const theta = phase + u * VORTEX.turns * Math.PI * 2;
    const rx = VORTEX.rxFrom + (VORTEX.rxTo - VORTEX.rxFrom) * u;
    const ry = VORTEX.ryFrom + (VORTEX.ryTo - VORTEX.ryFrom) * u;
    const cy = VORTEX.cyFrom + (VORTEX.cyTo - VORTEX.cyFrom) * u;
    const ex = rx * Math.cos(theta);
    const ey = ry * Math.sin(theta);
    const depth = Math.sin(theta); // 1 in front of the altar, -1 behind it
    const near = (depth + 1) / 2;
    last = lying + spin * u * 330 + Math.sin(theta * 3 + i) * 15;
    push(
      tGust + u * (tOrbit - tGust),
      VORTEX.cx + ex * cos - ey * sin,
      cy + ex * sin + ey * cos,
      last,
      DEPTH.back + (DEPTH.front - DEPTH.back) * near,
      round(DEPTH.dim + (1 - DEPTH.dim) * Math.min(1, near * 1.6)),
    );
  }
  // Drawn into the silhouette: each one to its own point of it, settling upright, shrinking, melting into the ink.
  const upright = Math.round(last / 360) * 360;
  const target = SILHOUETTE_POINTS[i % SILHOUETTE_POINTS.length] ?? { x: 0.5, y: 0.5 };
  const tx = SILHOUETTE.x + target.x * SILHOUETTE.w;
  const ty = SILHOUETTE.y + target.y * SILHOUETTE.h;
  push(tOrbit + (1 - tOrbit) * 0.7, tx, ty, upright, 0.55, 1);
  push(1, tx, ty, upright, 0.3, 0);
  return { x, y, rotate, scale, opacity, times };
}
