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
/** Where the talismans are torn from: the altar tray. */
const TRAY = { x: BOX.w / 2, y: 200 } as const;
/** The vortex: it rises and tightens around the altar while it turns. */
const VORTEX = { cx: BOX.w / 2, cyFrom: 176, cyTo: 116, rxFrom: 108, rxTo: 78, ryFrom: 34, ryTo: 22, turns: 1.35 } as const;

/** Beats in seconds from the start of the signature (≈ 3.5 s in all). */
export const SIG = (() => {
  const darken = duration.slow; // the card darkens: ink spreads over the paper
  const wind = duration.base; // the gust tears the talismans off the altar
  const swirl = duration.loop + duration.slow + duration.base; // they whirl around the altar
  const converge = duration.slow + duration.fast; // they close in on the silhouette
  const firstSeal = wind + duration.slow;
  const sealStep = duration.instant * 1.5; // 120 ms: well past the 50 ms dedupe of a cue
  const convergeAt = wind + swirl;
  const gong = convergeAt + converge;
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
    /** The last gong: the ink bursts like a blot on the paper, the dark lifts. */
    gong,
    splash: duration.celebrate,
    lift: duration.slow,
    end: gong + duration.celebrate + duration.base,
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
  talismans: { from: SIG.wind, to: SIG.gong },
  silhouette: { from: SIG.silhouetteAt, to: SIG.end },
  splash: { from: SIG.gong, to: SIG.end },
};

export type Span = { delay: number; length: number };

/** Every animation of the scene as a span (for the budget: ≤ 16 animated at once, signature exception of audit §D). */
export function animatedSpans(): Span[] {
  return [
    { delay: 0, length: SIG.darken }, // the ink spreads
    ...Array.from({ length: TALISMAN_COUNT }, () => ({ delay: SIG.wind, length: SIG.gong - SIG.wind })),
    ...Array.from({ length: TALISMAN_COUNT }, (_, i) => ({ delay: sealAt(i), length: SIG.sealFlash })),
    { delay: SIG.silhouetteAt, length: SIG.silhouetteIn },
    { delay: SIG.gong, length: SIG.splash }, // the silhouette bursts
    { delay: SIG.gong, length: SIG.splash }, // the blot
    { delay: SIG.gong + duration.fast, length: SIG.lift }, // the dark lifts
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

const ORBIT_STEPS = 20;
const round = (n: number) => Math.round(n * 10) / 10;

/**
 * The flight of talisman `i`: lying on the altar, torn off by the gust, whirled once and a third around the altar in a
 * rising, tightening vortex (bigger in front, smaller behind, fluttering), then drawn into the silhouette where it melts.
 */
export function talismanPath(i: number): TalismanPath {
  const flight = SIG.gong - SIG.wind;
  const tOrbit = SIG.swirl / flight;
  const phase = (i / TALISMAN_COUNT) * Math.PI * 2;
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
  // On the altar, a small fan of paper.
  push(0, TRAY.x + (i - (TALISMAN_COUNT - 1) / 2) * 4, TRAY.y, (i - (TALISMAN_COUNT - 1) / 2) * 6, 0.6, 0);
  // The vortex: the first step is the gust carrying it out to its place on the ring.
  for (let k = 0; k <= ORBIT_STEPS; k++) {
    const u = k / ORBIT_STEPS;
    const theta = phase + u * VORTEX.turns * Math.PI * 2;
    const rx = VORTEX.rxFrom + (VORTEX.rxTo - VORTEX.rxFrom) * u;
    const ry = VORTEX.ryFrom + (VORTEX.ryTo - VORTEX.ryFrom) * u;
    const cy = VORTEX.cyFrom + (VORTEX.cyTo - VORTEX.cyFrom) * u;
    const depth = Math.sin(theta); // 1 in front of the altar, -1 behind it
    const t = 0.06 + u * (tOrbit - 0.06);
    push(t, VORTEX.cx + rx * Math.cos(theta), cy + ry * depth, -Math.cos(theta) * 28 + Math.sin(theta * 3 + i) * 10, 0.9 + depth * 0.18, depth < -0.6 ? 0.75 : 1);
  }
  // Drawn into the silhouette: each one to its own point of it, shrinking, melting into the ink.
  const target = SILHOUETTE_POINTS[i % SILHOUETTE_POINTS.length] ?? { x: 0.5, y: 0.5 };
  const tx = SILHOUETTE.x + target.x * SILHOUETTE.w;
  const ty = SILHOUETTE.y + target.y * SILHOUETTE.h;
  push(tOrbit + (1 - tOrbit) * 0.7, tx, ty, 0, 0.55, 1);
  push(1, tx, ty, 0, 0.3, 0);
  return { x, y, rotate, scale, opacity, times };
}
