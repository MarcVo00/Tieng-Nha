import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { useServices } from "@/app/ServicesProvider";
import { ease } from "@/ui";
import headSrc from "@/assets/gacha/ink-dragon-head.svg?url";
import bodySrc from "@/assets/gacha/ink-dragon-body.svg?url";
import tailSrc from "@/assets/gacha/ink-dragon-tail.svg?url";
import bladeSrc from "@/assets/gacha/ink-dragon-blade.svg?url";
import veinsSrc from "@/assets/gacha/ink-dragon-veins.svg?url";
import type { SignatureProps } from "@/features/shop/signatures/types";
import { BLADE, BOX, DARK, dragonCues, dragonPath, FX, MOUNTED, occluderPath, POOL, SEGMENTS, segmentSize, SIG, SLICE_H, VEIN_BANDS, type Beat } from "@/features/shop/signatures/dragonSchedule";

// L'épée du dragon (spec more-banners §4.4), ≈ 3.7 s: the card darkens, the sword waits on the altar; ink splashes on
// the tray and an ink dragon rises out of it roaring, and coils one turn up round the sword, its body wrapping three
// quarters of it at once (big in front, smaller behind, where a slice of the blade drawn over it hides it); it goes up
// over the point and dives into the blade, narrowing to it, whose veins light gold from the point down as it pours in;
// the tail is in, the blade rings and blazes gold on the dark, the dark lifts round it and the sword gives way to the
// scroll. Every beat and sound runs on timers from one pure schedule, never on animation callbacks; delays and lengths
// come from `FX`; transform/opacity only, ≤ 16 animated at once (tested), no loop, everything unmounted at the end.

const ms = (s: number) => Math.round(s * 1000);
const BEATS = Object.keys(MOUNTED) as Beat[];
const PATHS = Array.from({ length: SEGMENTS }, (_, k) => ({ k, path: dragonPath(k), size: segmentSize(k), src: k === 0 ? headSrc : k === SEGMENTS - 1 ? tailSrc : bodySrc }));
const OCCLUDER = occluderPath();
/** The flare's keyframe offsets: the ring, the glow at its peak (the dark held till then), the dark lifted, the end. */
const FLARE = [0, (SIG.blazed - SIG.ring) / (SIG.end - SIG.ring), (SIG.lifted - SIG.ring) / (SIG.end - SIG.ring), 1];
/** Drawn back to front: the tail first, the head on top of its body. */
const DRAWN = [...PATHS].reverse();
/**
 * Easing of the keyframed beats that hold a value (the dark, the lit sword, the glow, the pool). Opacity runs on the
 * compositor (WAAPI), where one easing spans the whole timeline and would squash every hold into its first moments (the
 * sword faded 0.3 s early); the holds are written into the keyframes, so they run linear between them.
 */
const HELD = "linear";
const GLOW = 240;
const GLOW_AT = { x: BLADE.x + BLADE.w / 2, y: BLADE.y + 80 } as const;

const num = (v: unknown, fallback: number) => (typeof v === "number" ? v : typeof v === "string" ? Number.parseFloat(v) || fallback : fallback);
/**
 * A piece's transform, rotated before it is rolled: `scaleY` flips it about its own heading (its crest stays up when it
 * goes left), which motion's default order (scale before rotate) cannot do.
 */
function rolled(t: Record<string, unknown>): string {
  return `translateX(${num(t.x, 0)}px) translateY(${num(t.y, 0)}px) rotate(${num(t.rotate, 0)}deg) scale(${num(t.scale, 1)}) scaleY(${num(t.scaleY, 1)})`;
}

/**
 * The ink splashed on the tray (static, built once): a flattened splat, a small body thrown out into uneven spikes,
 * with drops of varied size flung around it, like a brush flicked at the paper.
 */
const POOL_PATH = (() => {
  const c = { x: POOL.w / 2, y: POOL.h / 2 };
  const at = (a: number, r: number) => ({ x: c.x + Math.cos(a) * r * 2.6, y: c.y + Math.sin(a) * r });
  const xy = (p: { x: number; y: number }) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  // [angle in turns, reach]: a spike, then a notch, irregularly.
  const lobes: [number, number][] = [
    [0, 19], [0.05, 8], [0.09, 13], [0.14, 7], [0.2, 16], [0.27, 9], [0.33, 12], [0.39, 6], [0.45, 18], [0.5, 9],
    [0.55, 14], [0.61, 7], [0.68, 17], [0.74, 8], [0.8, 11], [0.86, 6], [0.92, 15], [0.96, 8],
  ];
  const pts = lobes.map(([t, r]) => at(t * Math.PI * 2, r));
  const mid = (i: number) => {
    const p = pts[i % pts.length] ?? c;
    const q = pts[(i + 1) % pts.length] ?? c;
    return xy({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  };
  const body = `M${mid(0)} ${pts.map((_, i) => `Q${xy(pts[(i + 1) % pts.length] ?? c)} ${mid(i + 1)}`).join(" ")} Z`;
  const drops = ([[0.02, 21, 2.4], [0.17, 19, 1.4], [0.24, 18, 2], [0.42, 21, 1.6], [0.48, 20.5, 2.8], [0.6, 19, 1.3], [0.71, 18.5, 2.2], [0.9, 20, 1.5]] as const).map(
    ([t, r, d]) => {
      const p = at(t * Math.PI * 2, r);
      return `M${(p.x - d).toFixed(1)} ${p.y.toFixed(1)} a${d} ${d} 0 1 0 ${2 * d} 0 a${d} ${d} 0 1 0 ${-2 * d} 0`;
    },
  );
  return [body, ...drops].join(" ");
})();

export function DragonSword({ onEnd, reduced }: SignatureProps) {
  const { sound } = useServices();
  // The end is read at its time, so a new `onEnd` identity never restarts the scene.
  const end = useRef(onEnd);
  end.current = onEnd;
  // What is on screen from the first frame (the sword on the altar); the rest mounts on its timer.
  const [on, setOn] = useState<ReadonlySet<Beat>>(() => new Set(BEATS.filter((b) => MOUNTED[b].from === 0)));

  useEffect(() => {
    if (reduced) {
      end.current();
      return undefined;
    }
    const timers: number[] = [];
    const at = (s: number, run: () => void) => timers.push(window.setTimeout(run, ms(s)));
    for (const c of dragonCues()) at(c.at, () => sound.play(c.cue));
    for (const beat of BEATS) {
      const span = MOUNTED[beat];
      if (span.from > 0) at(span.from, () => setOn((s) => new Set(s).add(beat)));
      at(span.to, () =>
        setOn((s) => {
          const next = new Set(s);
          next.delete(beat);
          return next;
        }),
      );
    }
    at(SIG.end, () => end.current());
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [reduced, sound]);

  if (reduced) return null;
  const rung = on.has("flare");
  const since = (beat: Beat, at: number) => at - MOUNTED[beat].from; // a delay, from the element's own mount
  return (
    <div aria-hidden="true" data-signature="acc_kiem_rong" className="pointer-events-none absolute inset-0 overflow-hidden" style={{ width: BOX.w, height: BOX.h }}>
      {/* The card darkens like a storm over the altar, and lifts as the blade rings. */}
      <motion.span
        className="absolute inset-0 bg-fx-ink"
        initial={{ opacity: 0 }}
        // At the ring it holds while the glow swells, then lifts round the blazing sword.
        animate={{ opacity: rung ? [DARK, DARK, 0] : DARK }}
        transition={
          rung
            ? { duration: SIG.lifted - SIG.ring, times: [0, (SIG.blazed - SIG.ring) / (SIG.lifted - SIG.ring), 1], ease: HELD }
            : { duration: FX.darken.length, ease: ease.out }
        }
      />
      {/* Ink splashes on the tray at the foot of the sword: the dragon rises out of it. */}
      {on.has("pool") ? (
        <motion.svg
          data-fx="pool"
          viewBox={`0 0 ${POOL.w} ${POOL.h}`}
          width={POOL.w}
          height={POOL.h}
          className="absolute"
          style={{ left: POOL.x - POOL.w / 2, top: POOL.y - POOL.h / 2 }}
          initial={{ opacity: 0, scale: 0.3 }}
          animate={{ opacity: [0, 1, 1, 0], scale: [0.3, 1, 1, 0.9] }}
          transition={{ duration: FX.pool.length, delay: since("pool", FX.pool.delay), times: [0, 0.2, 0.6, 1], ease: HELD }}
        >
          <path d={POOL_PATH} fill="var(--fx-ink)" />
        </motion.svg>
      ) : null}
      {/* The blade blazes: gold light bursting from behind it as it rings. */}
      {rung ? (
        <motion.span
          data-fx="glow"
          className="absolute rounded-full"
          style={{
            left: GLOW_AT.x - GLOW / 2,
            top: GLOW_AT.y - GLOW / 2,
            width: GLOW,
            height: GLOW,
            background: "radial-gradient(closest-side, var(--fx-gold), var(--fx-gold) 30%, transparent)",
          }}
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: [0, 0.9, 0.5, 0], scale: [0.4, 1.1, 1.3, 1.4] }}
          transition={{ duration: FX.glow.length, times: FLARE, ease: HELD }}
        />
      ) : null}
      {on.has("blade") ? (
        <motion.span
          data-fx="blade"
          className="absolute"
          style={{ left: BLADE.x, top: BLADE.y, width: BLADE.w, height: BLADE.h, transformOrigin: "50% 70%" }}
          initial={{ opacity: 0, scale: 0.94 }}
          // It waits on the altar; at the ring it swells a little and gives way to the scroll.
          animate={rung ? { opacity: [1, 1, 1, 0], scale: [1, 1.07, 1.03, 1.03] } : { opacity: 1, scale: 1 }}
          transition={rung ? { duration: FX.fade.length, times: FLARE, ease: HELD } : { duration: FX.bladeIn.length, ease: ease.out }}
        >
          <img src={bladeSrc} alt="" draggable={false} className="absolute inset-0 h-full w-full select-none" />
          {/* The veins light gold from the point down, band by band, as the dragon pours in. */}
          {on.has("veins")
            ? VEIN_BANDS.map((b, i) => (
                <motion.span
                  key={i}
                  data-fx="vein"
                  className="absolute left-0 overflow-hidden"
                  style={{ top: b.top, width: BLADE.w, height: b.h }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: FX.vein(i).length, delay: since("veins", FX.vein(i).delay), ease: ease.out }}
                >
                  <img src={veinsSrc} alt="" draggable={false} className="absolute left-0 max-w-none select-none" style={{ top: -b.top, width: BLADE.w, height: BLADE.h }} />
                </motion.span>
              ))
            : null}
        </motion.span>
      ) : null}
      {on.has("dragon")
        ? DRAWN.map(({ k, path: p, size, src }) => (
            <motion.img
              key={k}
              data-fx="dragon"
              src={src}
              alt=""
              draggable={false}
              className="absolute max-w-none select-none"
              style={{ left: -size.w / 2, top: -size.h / 2, width: size.w, height: size.h }}
              transformTemplate={rolled}
              initial={{ x: p.x[0] ?? 0, y: p.y[0] ?? 0, rotate: p.rotate[0] ?? 0, scale: p.scale[0] ?? 1, scaleY: p.scaleY[0] ?? 1, opacity: p.opacity[0] ?? 0 }}
              animate={{ x: p.x, y: p.y, rotate: p.rotate, scale: p.scale, scaleY: p.scaleY, opacity: p.opacity }}
              // "linear" between samples: the path is already sampled densely, so an eased segment would make the ink
              // hesitate at every sample; the catalogue easings are for one-segment moves.
              transition={{ duration: FX.piece(k).length, delay: since("dragon", FX.piece(k).delay), times: p.times, ease: "linear" }}
            />
          ))
        : null}
      {/* Behind the sword: a slice of the blade drawn over the dragon, on the pass behind only (the art inside moves the
          opposite way, so the slice is always exactly the blade under it). */}
      {on.has("occluder") ? (
        <motion.span
          data-fx="occluder"
          className="absolute overflow-hidden"
          style={{ left: BLADE.x, top: 0, width: BLADE.w, height: SLICE_H }}
          initial={{ y: OCCLUDER.y[0] ?? 0, opacity: 0 }}
          animate={{ y: OCCLUDER.y, opacity: OCCLUDER.opacity }}
          transition={{ duration: FX.occluder.length, delay: since("occluder", FX.occluder.delay), times: OCCLUDER.times, ease: "linear" }}
        >
          <motion.img
            src={bladeSrc}
            alt=""
            draggable={false}
            className="absolute left-0 max-w-none select-none"
            style={{ top: BLADE.y, width: BLADE.w, height: BLADE.h }}
            initial={{ y: -(OCCLUDER.y[0] ?? 0) }}
            animate={{ y: OCCLUDER.y.map((v) => -v) }}
            transition={{ duration: FX.occluder.length, delay: since("occluder", FX.occluder.delay), times: OCCLUDER.times, ease: "linear" }}
          />
        </motion.span>
      ) : null}
    </div>
  );
}
