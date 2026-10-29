import type { GachaPullItem, Rarity } from "@/domain/types";
import { RARITY_ORDER } from "@/services/gacha";
import { duration } from "@/ui/motion";
import { hasSignature } from "@/features/shop/signatures";

// The gacha reveal as data (spec sound-and-reveal §5): beat lengths composed from the motion tokens (like `FIGHT`),
// constant stage geometry (no DOM measure during the animation) and the sequence as a reducer. The animation is decor:
// nothing here ever changes the pull, so skipping shows exactly what the server drew.

export { hasSignature };

/** Reveal beats in seconds, composed from `duration` (no raw value of their own). */
export const REVEAL = {
  /** One shake of the tube (±6°, the sticks rattle). A tap = one shake; holding repeats it up to `maxShakes`. */
  shake: duration.slow * 2,
  maxShakes: 3,
  /** The bare sticks rise out of the tube together: the start of every omen. */
  rise: duration.slow,
  /** Common: one wood clack, a breath, and the cards. */
  settle: duration.base,
  /** Rare: the jade glow spreads on the altar. Epic: the two lanterns come down and light up. */
  glow: duration.celebrate,
  /** Epic: the lanterns stay lit a moment before the cards. */
  lanternsLit: duration.slow,
  /** Legendary: the whole altar holds its breath after the sticks rise (the deep gong rings out). */
  pause: duration.slow + duration.base,
  /** Legendary: the gold light floods the altar, the static rays fade in. */
  flood: duration.celebrate,
  /** Legendary: the existing confetti, once, when the gold is full. */
  confetti: duration.celebrate,
  /** One face-down card dealt onto the panel, and the gap between two cards. */
  deal: duration.base,
  dealStagger: duration.instant,
  /** A card turns over in place (scaleX 1 → 0 → 1), then its focus view opens. */
  flip: duration.fast * 2,
  /** « Tout découvrir »: from one card turning over to the next. */
  chainStep: duration.slow,
  /** Focus view: the paper scroll unrolls from its top roller (scaleY), then its content, then the rarity seal. */
  unroll: duration.slow,
  content: duration.base,
  seal: duration.slow + duration.base,
  /** Legendary focus view: the static gold rays fade in, then hold a moment before the scroll unrolls over them. */
  raysIn: duration.slow,
  goldHold: duration.slow + duration.base,
} as const;

/**
 * When the scroll's parts appear, from `delay` (seconds). Without a signature the card flip bridges the gap: the paper
 * fades in as it unrolls, then the content, then the seal. After a signature the scene hands over to it directly, so
 * the paper is there from the first frame (never a bare altar) and the content rises halfway through the unroll
 * (never an empty scroll).
 */
export function scrollBeats(delay: number, signed: boolean): { paper: number; contentAt: number; sealAt: number } {
  const contentAt = delay + (signed ? REVEAL.unroll / 2 : REVEAL.unroll);
  return { paper: signed ? 1 : 0, contentAt, sealAt: contentAt + REVEAL.content };
}

/** Performance budgets (audit §D.4). */
export const BUDGET = { animated: 8, particles: 12 } as const;

const rank = (r: Rarity) => RARITY_ORDER.indexOf(r);

/** The best rarity of a pull: the only thing the omen tells. */
export function topRarity(items: readonly GachaPullItem[]): Rarity {
  return items.reduce<Rarity>((best, it) => (rank(it.rarity) > rank(best) ? it.rarity : best), "common");
}

/** Length of the omen in seconds, longer and fuller for a rarer best piece; a pull of commons stays brief. */
export function omenDuration(top: Rarity): number {
  switch (top) {
    case "common":
      return REVEAL.rise + REVEAL.settle;
    case "rare":
      return REVEAL.rise + REVEAL.glow;
    case "epic":
      return REVEAL.rise + REVEAL.glow + REVEAL.lanternsLit;
    case "legendary":
      return REVEAL.rise + REVEAL.pause + REVEAL.flood + REVEAL.confetti;
  }
}

/** Legendary omen: when the gold starts flooding, and when the confetti fire (seconds from the start of the omen). */
export const LEGENDARY_OMEN = { flood: REVEAL.rise + REVEAL.pause, confetti: REVEAL.rise + REVEAL.pause + REVEAL.flood } as const;

/** Epic omen: when the lanterns come down, and when they light up (seconds from the start of the omen). */
export const EPIC_OMEN = { drop: REVEAL.rise, light: REVEAL.rise + duration.slow } as const;

export type Span = { delay: number; length: number };

/** When each face-down card is dealt and for how long. */
export function dealSchedule(count: number): Span[] {
  return Array.from({ length: count }, (_, i) => ({ delay: i * REVEAL.dealStagger, length: REVEAL.deal }));
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
/** Centre of the tube mouth: every stick rises from here. */
export const MOUTH = { x: STAGE.w / 2, y: Math.round(TUBE.y + 44 * ART) } as const;
/** Stick art ratio (18 x 110). */
export const STICK_RATIO = 18 / 110;

/** The bare sticks that rise out of the tube: a x10 shows a bundle of five (animation budget), a x1 its one stick. */
export function risingSticks(count: number): { rotate: number }[] {
  const n = Math.min(count, 5);
  return Array.from({ length: n }, (_, i) => ({ rotate: (i - (n - 1) / 2) * 7 }));
}

/** Card art ratio (card-back.svg is 150 x 144): the face-down and face-up cards share it (about 130 px tall at 360 px). */
export const CARD_RATIO = 150 / 144;

/** Recap order (indices into the pull): new pieces first, then rarest first, then draw order. */
export function recapOrder(items: readonly GachaPullItem[]): number[] {
  return items
    .map((it, i) => ({ it, i }))
    .sort((a, b) => Number(a.it.duplicate) - Number(b.it.duplicate) || rank(b.it.rarity) - rank(a.it.rarity) || a.i - b.i)
    .map((x) => x.i);
}

/** « Tout découvrir »: the cards still face down, lowest rarity first so the best comes last (draw order within one). */
export function revealAllOrder(items: readonly GachaPullItem[], flipped: readonly boolean[]): number[] {
  return items
    .map((it, i) => ({ it, i }))
    .filter((x) => flipped[x.i] !== true)
    .sort((a, b) => rank(a.it.rarity) - rank(b.it.rarity) || a.i - b.i)
    .map((x) => x.i);
}

// --- The sequence ---

export type RevealPhase = "tube" | "shaking" | "omen" | "cards" | "focus" | "signature" | "recap";

export type RevealState = {
  readonly items: readonly GachaPullItem[];
  phase: RevealPhase;
  /** The best rarity of the pull (the omen). */
  top: Rarity;
  /** Cards turned face up (or skipped to the recap). */
  flipped: boolean[];
  /** The card being turned over / shown in the focus view. */
  current: number | null;
  /** « Tout découvrir »: the cards still to turn over after `current`. */
  queue: number[];
  /** Shake cycle being played (0-based). */
  shake: number;
  /** The finger is still on the tube. */
  held: boolean;
};

export type RevealAction =
  | { type: "press" }
  | { type: "release" }
  | { type: "shakeEnd" }
  | { type: "omenEnd" }
  | { type: "flip"; index: number }
  | { type: "close" }
  | { type: "revealAll" }
  | { type: "signatureEnd" }
  | { type: "skip" };

/** `direct`: reduced motion or a recovered pull (already drawn: nothing to shake), straight to the recap. */
export function initialReveal(items: readonly GachaPullItem[], opts: { direct: boolean }): RevealState {
  return {
    items,
    phase: opts.direct ? "recap" : "tube",
    top: topRarity(items),
    flipped: items.map(() => opts.direct),
    current: null,
    queue: [],
    shake: 0,
    held: false,
  };
}

/** Turns card `index` over and opens it: through its signature the first time, if the piece has one. */
function open(s: RevealState, index: number, queue: number[]): RevealState {
  const it = s.items[index];
  if (!it) return s;
  const first = s.flipped[index] !== true;
  const signature = first && it.rarity === "legendary" && hasSignature(it.itemId);
  return { ...s, phase: signature ? "signature" : "focus", current: index, queue, flipped: s.flipped.map((f, i) => f || i === index) };
}

export function revealReducer(s: RevealState, a: RevealAction): RevealState {
  switch (a.type) {
    case "press":
      return s.phase === "tube" ? { ...s, phase: "shaking", shake: 0, held: true } : s;
    case "release":
      return s.held ? { ...s, held: false } : s;
    case "shakeEnd":
      if (s.phase !== "shaking") return s;
      return s.held && s.shake + 1 < REVEAL.maxShakes ? { ...s, shake: s.shake + 1 } : { ...s, phase: "omen", held: false };
    case "omenEnd":
      return s.phase === "omen" ? { ...s, phase: "cards" } : s;
    case "flip":
      return s.phase === "cards" && s.items[a.index] ? open(s, a.index, []) : s;
    case "signatureEnd":
      return s.phase === "signature" ? { ...s, phase: "focus" } : s;
    case "close": {
      if (s.phase !== "focus") return s;
      const [next, ...rest] = s.queue;
      if (next !== undefined) return open(s, next, rest);
      return { ...s, phase: s.flipped.every(Boolean) ? "recap" : "cards", current: null };
    }
    case "revealAll": {
      if (s.phase !== "cards") return s;
      const [first, ...rest] = revealAllOrder(s.items, s.flipped);
      return first === undefined ? { ...s, phase: "recap" } : open(s, first, rest);
    }
    case "skip":
      return s.phase === "recap" ? s : { ...s, phase: "recap", held: false, current: null, queue: [], flipped: s.items.map(() => true) };
  }
}

/**
 * During « Tout découvrir » a card turns over in the grid and the next follows by itself; a legendary and the last card
 * open their focus view and wait for « Continuer » (the reveal ends on the best piece).
 */
export function autoAdvance(s: RevealState): boolean {
  if (s.phase !== "focus" || s.current === null || s.queue.length === 0) return false;
  return s.items[s.current]?.rarity !== "legendary";
}
