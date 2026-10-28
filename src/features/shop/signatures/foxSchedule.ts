import type { SoundCue } from "@/domain/sound";
import { duration } from "@/ui/motion";

// La renarde à neuf queues (spec more-banners §4.4) as data: one pure schedule for the beats, the sounds, the lanterns
// and the nine tails. Beats are composed from the motion tokens; positions are constants of the focus view (no DOM
// measure during the scene). The component only reads this.

/** The focus view the signature fills: the 256 x 264 paper stage of the reveal (a test keeps it equal to `STAGE`). */
export const BOX = { w: 256, h: 264 } as const;

/** Drawn size of a lantern (lantern.svg is 48 x 76), and where each one hangs on its cord from the top of the stage. */
export const LANTERN = { w: 32, h: Math.round((32 * 76) / 48) } as const;
export const LANTERNS = [
  { x: 16, y: 26 },
  { x: 68, y: 44 },
  { x: BOX.w - 68 - LANTERN.w, y: 36 },
  { x: BOX.w - 16 - LANTERN.w, y: 18 },
] as const;
export const LANTERN_COUNT = LANTERNS.length;
/** The order they go out in: from the outside in, one side then the other, closing on her. */
export const OUT_ORDER = [0, 3, 1, 2] as const;
/** The halo of a lit lantern (centred on its paper body), and the smoke of its breath (lantern-smoke.svg, 20 x 44). */
export const LIGHT = 92;
export const SMOKE = { w: 18, h: 40 } as const;

/** Her ink silhouette (ink-fox-silhouette.svg is 120 x 160, her body's own canvas), standing on the altar. */
export const FOX = { w: 108, h: 144, x: (BOX.w - 108) / 2, y: 100 } as const;
/** Where her tails grow from: low on her back (the body art's tail roots, 60 x 106 of 120 x 160). */
export const ROOT = { x: FOX.x + FOX.w / 2, y: Math.round(FOX.y + (106 / 160) * FOX.h) } as const;
/** Drawn size of one tail (foxfire-tail.svg is 44 x 112, root at the bottom centre). */
export const TAIL = { w: 40, h: 104 } as const;
/**
 * The nine tails, back to front as the body art draws them: the middle one behind, the pairs outward on top. Angles
 * from upright (degrees), and a size for depth (the outer ones further back, like the body art's shorter tail4).
 */
export const TAILS = [0, -24, 24, -48, 48, -72, 72, -98, 98].map((angle) => ({
  angle,
  ring: Math.abs(angle) < 1 ? 0 : Math.ceil(Math.abs(angle) / 25),
  scale: [1.08, 1.02, 0.96, 0.9, 0.82][Math.abs(angle) < 1 ? 0 : Math.ceil(Math.abs(angle) / 25)] ?? 0.82,
}));
/** How dark the card gets, step by step as the lanterns die: the fire must blaze on it. */
export const DARK = 0.88;
const DUSK = 0.2;
/** How bright a lit lantern's halo is. */
export const LIT = 0.8;

/** Beats in seconds from the start of the signature (≈ 3.3 s in all). */
export const SIG = (() => {
  const dusk = duration.slow; // night falls on the lit lanterns
  const firstOut = duration.slow + duration.fast; // they glow a moment, then the first dies
  const outStep = duration.base + duration.instant; // 300 ms between two breaths: well past the 50 ms dedupe of a cue
  const out = duration.base; // a lantern gutters and dies
  const lastOut = firstOut + (LANTERNS.length - 1) * outStep;
  const fan = lastOut + out + duration.instant; // in the dark, the cold fire catches
  const tailStep = duration.instant * 0.75; // each pair of tails a beat after the one inside it
  const unfurl = duration.slow + duration.fast; // one tail sweeps out to its place
  const rings = 4;
  const fanned = fan + rings * tailStep + unfurl;
  const bells = fanned + duration.instant; // the ring of bells: her eyes open
  const blaze = duration.base; // the fire at its peak, on the dark
  const lift = duration.slow; // the dark lifts round her
  const handOver = duration.fast; // she gives way to the scroll
  return {
    dusk,
    firstOut,
    outStep,
    out,
    lastOut,
    fan,
    tailStep,
    unfurl,
    fanned,
    bells,
    /** The fire at its peak: until then the dark holds. */
    blazed: bells + blaze,
    /** The dark has lifted; she and her tails are still whole. */
    lifted: bells + blaze + lift,
    /** The scroll takes over (no empty beat). */
    end: bells + blaze + lift + handOver,
  } as const;
})();

/** When the `n`-th lantern to die goes out (0-based, in `OUT_ORDER`). */
export const outAt = (n: number): number => SIG.firstOut + n * SIG.outStep;
/** When lantern `i` (its place in `LANTERNS`) goes out. */
export const lanternOutAt = (i: number): number => outAt(OUT_ORDER.indexOf(i as (typeof OUT_ORDER)[number]));

export type SignatureCue = { at: number; cue: SoundCue };

/** The sounds of the scene, in order: a breath per lantern, the cold fire as the tails fan out, the bells. */
export function foxCues(): SignatureCue[] {
  return [
    ...Array.from({ length: LANTERN_COUNT }, (_, n): SignatureCue => ({ at: outAt(n), cue: "sig.lantern" })),
    { at: SIG.fan, cue: "sig.foxfire" },
    { at: SIG.bells, cue: "sig.bells" },
  ];
}

export type Span = { delay: number; length: number };

/**
 * Every animation of the scene, in seconds from its start. The component takes its delays and lengths from here (each
 * relative to its element's mount), so the budget below counts what is actually animated.
 */
export const FX = {
  /** The ink overlay: dusk, then a step darker as each lantern dies (one element; its lift never overlaps this). */
  darken: { delay: 0, length: SIG.lastOut + SIG.out },
  lift: { delay: SIG.blazed, length: SIG.lifted - SIG.blazed },
  /** The lanterns (one wrapper) come out of the dusk. */
  lanternsIn: { delay: 0, length: SIG.dusk },
  /**
   * Lantern `i`'s halo: it lights with the dusk (a frame after the lanterns land), holds, gutters and dies with its
   * breath (one keyframed timeline).
   */
  light: (i: number): Span => ({ delay: duration.instant, length: lanternOutAt(i) + SIG.out - duration.instant }),
  /** The smoke of its breath rising. */
  smoke: (i: number): Span => ({ delay: lanternOutAt(i), length: duration.celebrate }),
  /** The cold glow behind her: it catches with the fire, holds, blazes at the bells, and fades with the hand-over. */
  glow: { delay: SIG.fan, length: SIG.end - SIG.fan },
  /** She stands out of the dark, backlit by her fire. */
  silhouette: { delay: SIG.fan, length: duration.slow },
  /** Tail `j` sweeps out from behind her, the middle one first, each pair a beat after the one inside it. */
  tail: (j: number): Span => ({ delay: SIG.fan + (TAILS[j]?.ring ?? 0) * SIG.tailStep, length: SIG.unfurl }),
  /** Cold sparks crackle off the tails as they fan out (one SVG, nine sparks). */
  sparks: { delay: SIG.fan + 2 * SIG.tailStep, length: duration.celebrate },
  /** The bells: the fan flares once (one wrapper), her eyes snap open, a ring of cold light goes out from her. */
  flare: { delay: SIG.bells, length: duration.slow },
  eyes: { delay: SIG.bells, length: duration.base },
  chime: { delay: SIG.bells, length: duration.slow + duration.base },
  /** She gives way to the scroll (one wrapper over her, her tails and her eyes). */
  handOver: { delay: SIG.lifted, length: SIG.end - SIG.lifted },
} as const;

/** What is on screen: mounted between `from` and `to` (seconds), unmounted outside. */
export type Beat = "lanterns" | "lights" | "smoke" | "fox" | "tails" | "sparks" | "chime";
export const MOUNTED: Readonly<Record<Beat, { from: number; to: number }>> = {
  // The lanterns hang lit from the first frame; the rest lands on frames of its own, away from the card opening and
  // from any breath, so no frame carries two mounts (4x CPU).
  lanterns: { from: 0, to: SIG.end },
  lights: { from: duration.instant, to: SIG.lastOut + SIG.out },
  smoke: { from: (SIG.dusk + outAt(0)) / 2 - duration.instant, to: outAt(LANTERN_COUNT - 1) + duration.celebrate },
  // She mounts unseen in the dark between two breaths, her tails between the last two, before her fire catches.
  fox: { from: (outAt(LANTERN_COUNT - 3) + SIG.out + outAt(LANTERN_COUNT - 2)) / 2, to: SIG.end },
  tails: { from: (outAt(LANTERN_COUNT - 2) + SIG.out + outAt(LANTERN_COUNT - 1)) / 2, to: SIG.end },
  sparks: { from: FX.sparks.delay, to: FX.sparks.delay + FX.sparks.length },
  chime: { from: SIG.bells, to: SIG.end },
};

/** Every animated element's span (for the budget: ≤ 16 animated at once, signature exception of audit §D). */
export function animatedSpans(): Span[] {
  return [
    FX.darken,
    FX.lift,
    FX.lanternsIn,
    ...LANTERNS.map((_, i) => FX.light(i)),
    ...LANTERNS.map((_, i) => FX.smoke(i)),
    FX.glow,
    FX.silhouette,
    ...TAILS.map((_, j) => FX.tail(j)),
    FX.sparks,
    FX.flare,
    FX.eyes,
    FX.chime,
    FX.handOver,
  ];
}

export type Keys = { opacity: number[]; times: number[] };
const offset = (at: number, length: number) => Math.round((at / length) * 1000) / 1000;

/** The dark over `FX.darken`: dusk, then each lantern's death takes a step of it, to `DARK` once the last is out. */
export function darkKeys(): Keys {
  const len = FX.darken.length;
  const levels = Array.from({ length: LANTERN_COUNT + 1 }, (_, n) => Math.round((DUSK + ((DARK - DUSK) * n) / LANTERN_COUNT) * 100) / 100);
  const out: Keys = { opacity: [0, DUSK], times: [0, offset(SIG.dusk, len)] };
  for (let n = 0; n < LANTERN_COUNT; n++) {
    out.opacity.push(levels[n] ?? DUSK, levels[n + 1] ?? DARK);
    out.times.push(offset(outAt(n), len), offset(outAt(n) + SIG.out, len));
  }
  return out;
}

/** Lantern `i`'s halo over `FX.light(i)`: it lights with the dusk, holds, flares as it gutters, flickers once, dies. */
export function lightKeys(i: number): Keys {
  const { delay, length } = FX.light(i);
  const at = lanternOutAt(i) - delay;
  const gutter = [0.2, 0.45, 0.65, 1].map((f) => offset(at + f * SIG.out, length));
  return {
    opacity: [0, LIT, LIT, 1, 0.3, 0.55, 0],
    times: [0, offset(SIG.dusk - delay, length), offset(at, length), ...gutter],
  };
}
