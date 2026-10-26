import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { useServices } from "@/app/ServicesProvider";
import { ease } from "@/ui";
import talismanSrc from "@/assets/gacha/talisman.svg?url";
import silhouetteSrc from "@/assets/gacha/ink-silhouette.svg?url";
import type { SignatureProps } from "@/features/shop/signatures/types";
import { BOX, DARK, FX, MOUNTED, SIG, SILHOUETTE, TALISMAN, TALISMAN_COUNT, talismanCues, talismanPath, type Beat } from "@/features/shop/signatures/talismanSchedule";

// La gardienne des talismans (spec sound-and-reveal §6.2), ≈ 3 s: the card darkens; a gust tears twelve paper
// talismans off the altar and whirls them around it; one by one their seals catch fire, each with a stroke of the brush;
// they close in on an ink silhouette; a last gong, she dissolves into a blot of ink bursting on the paper, and appears
// (the focus view's scroll takes over). Every beat and sound runs on timers from one pure schedule, never on animation
// callbacks; delays and lengths come from `FX`; transform/opacity only, ≤ 16 animated at once (tested), no loop,
// everything unmounted at the end.

const ms = (s: number) => Math.round(s * 1000);
/** Lit seal: the red seal (centre 12, 11 of the 24 x 52 art) burns gold. */
const SEAL = { size: 18, x: TALISMAN.w / 2, y: Math.round((11 / 52) * TALISMAN.h) } as const;
const BEATS = Object.keys(MOUNTED) as Beat[];
const PATHS = Array.from({ length: TALISMAN_COUNT }, (_, i) => talismanPath(i));
const CENTRE = { x: SILHOUETTE.x + SILHOUETTE.w / 2, y: SILHOUETTE.y + SILHOUETTE.h / 2 } as const;
const BLOT = 300;
/**
 * A splash of ink (static, built once): a body of uneven lobes at uneven angles, three long splatter streaks thrown out
 * of it, and drops of varied size and distance. Its reach (≈ 66–112 px) spreads around the whole silhouette.
 */
const BLOT_PATH = (() => {
  const c = BLOT / 2;
  const at = (a: number, r: number) => ({ x: c + Math.cos(a) * r, y: c + Math.sin(a) * r });
  const xy = (p: { x: number; y: number }) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  // [angle in turns, reach]: deliberately irregular.
  const lobes: [number, number][] = [
    [0, 96], [0.06, 74], [0.11, 104], [0.19, 80], [0.24, 92], [0.3, 70], [0.38, 112], [0.43, 78], [0.5, 88],
    [0.57, 66], [0.62, 100], [0.69, 76], [0.76, 108], [0.8, 72], [0.86, 90], [0.93, 68],
  ];
  const pts = lobes.map(([t, r]) => at(t * Math.PI * 2, r));
  const mid = (i: number) => {
    const p = pts[i % pts.length] ?? at(0, 0);
    const q = pts[(i + 1) % pts.length] ?? at(0, 0);
    return xy({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  };
  const body = `M${mid(0)} ${pts.map((_, i) => `Q${xy(pts[(i + 1) % pts.length] ?? at(0, 0))} ${mid(i + 1)}`).join(" ")} Z`;
  // Streaks: a tapering spike from inside the body out to a point, a drop at its tip. [angle in turns, length, width].
  const streaks = ([[0.15, 140, 0.07], [0.47, 132, 0.06], [0.72, 146, 0.05]] as const).map(([t, len, w]) => {
    const a = t * Math.PI * 2;
    const tip = at(a, len);
    const drop = at(a, len + 7);
    return `M${xy(at(a - w, 70))} L${xy(tip)} L${xy(at(a + w, 70))} Z M${(drop.x - 4).toFixed(1)} ${drop.y.toFixed(1)} a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0`;
  });
  // Loose drops: [angle in turns, distance, radius].
  const drops = ([[0.03, 122, 6], [0.27, 118, 3], [0.34, 134, 5], [0.55, 110, 9], [0.64, 128, 3.5], [0.84, 120, 7], [0.9, 140, 3]] as const).map(
    ([t, r, d]) => {
      const p = at(t * Math.PI * 2, r);
      return `M${(p.x - d).toFixed(1)} ${p.y.toFixed(1)} a${d} ${d} 0 1 0 ${2 * d} 0 a${d} ${d} 0 1 0 ${-2 * d} 0`;
    },
  );
  return [body, ...streaks, ...drops].join(" ");
})();

export function TalismanGuardian({ onEnd, reduced }: SignatureProps) {
  const { sound } = useServices();
  // The end is read at its time, so a new `onEnd` identity never restarts the scene.
  const end = useRef(onEnd);
  end.current = onEnd;
  // What is on screen from the first frame (the talismans lying on the altar); the rest mounts on its timer.
  const [on, setOn] = useState<ReadonlySet<Beat>>(() => new Set(BEATS.filter((b) => MOUNTED[b].from === 0)));

  useEffect(() => {
    if (reduced) {
      end.current();
      return undefined;
    }
    const timers: number[] = [];
    const at = (s: number, run: () => void) => timers.push(window.setTimeout(run, ms(s)));
    for (const c of talismanCues()) at(c.at, () => sound.play(c.cue));
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
  const burst = on.has("splash");
  const since = (beat: Beat, at: number) => at - MOUNTED[beat].from; // a delay, from the element's own mount
  return (
    <div aria-hidden="true" data-signature="char_phap_su" className="pointer-events-none absolute inset-0 overflow-hidden" style={{ width: BOX.w, height: BOX.h }}>
      {/* The card darkens: ink spreads over the paper, and lifts with the gong. */}
      <motion.span
        className="absolute inset-0 bg-fx-ink"
        initial={{ opacity: 0 }}
        animate={{ opacity: burst ? 0 : DARK }}
        transition={burst ? { duration: FX.lift.length, ease: ease.out } : { duration: FX.darken.length, ease: ease.out }}
      />
      {/* The blot, under her: she dissolves into the ink as it bursts out around her (no torn piece of her rim). */}
      {burst ? (
        <motion.svg
          data-fx="blot"
          viewBox={`0 0 ${BLOT} ${BLOT}`}
          width={BLOT}
          height={BLOT}
          className="absolute"
          style={{ left: CENTRE.x - BLOT / 2, top: CENTRE.y - BLOT / 2 }}
          initial={{ opacity: 1, scale: 0.5, rotate: -8 }}
          animate={{ opacity: 0, scale: 1, rotate: 0 }}
          transition={{
            scale: { duration: FX.blotGrow.length, ease: ease.out },
            rotate: { duration: FX.blotGrow.length, ease: ease.out },
            opacity: { duration: FX.blotFade.length, delay: since("splash", FX.blotFade.delay), ease: ease.out },
          }}
        >
          <path d={BLOT_PATH} fill="var(--fx-ink)" />
        </motion.svg>
      ) : null}
      {on.has("silhouette") ? (
        <motion.img
          data-fx="silhouette"
          src={silhouetteSrc}
          alt=""
          draggable={false}
          className="absolute select-none"
          style={{ left: SILHOUETTE.x, top: SILHOUETTE.y, width: SILHOUETTE.w, height: SILHOUETTE.h }}
          initial={{ opacity: 0, scale: 0.86 }}
          // It inks in while the talismans close on it, then dissolves at once with the gong.
          animate={burst ? { opacity: 0, scale: 1.1 } : { opacity: 1, scale: 1 }}
          transition={{ duration: burst ? FX.silhouetteOut.length : FX.silhouetteIn.length, ease: ease.out }}
        />
      ) : null}
      {on.has("talismans")
        ? PATHS.map((p, i) => (
            <motion.span
              key={i}
              data-fx="talisman"
              className="absolute"
              style={{ left: -TALISMAN.w / 2, top: -TALISMAN.h / 2, width: TALISMAN.w, height: TALISMAN.h }}
              initial={{ x: p.x[0] ?? 0, y: p.y[0] ?? 0, rotate: p.rotate[0] ?? 0, scale: p.scale[0] ?? 1, opacity: p.opacity[0] ?? 1 }}
              animate={{ x: p.x, y: p.y, rotate: p.rotate, scale: p.scale, opacity: p.opacity }}
              // "linear" between samples: the path is already sampled densely, so an eased segment would make the paper
              // hesitate at every sample; the catalogue easings are for one-segment moves.
              transition={{ duration: FX.flight.length, delay: since("talismans", FX.flight.delay), times: p.times, ease: "linear" }}
            >
              <img src={talismanSrc} alt="" draggable={false} className="absolute inset-0 h-full w-full select-none" />
              {/* The seal catches fire: a gold ember over the red, flaring then settling; it stays lit. */}
              <motion.span
                data-fx="seal"
                className="absolute rounded-full"
                style={{
                  left: SEAL.x - SEAL.size / 2,
                  top: SEAL.y - SEAL.size / 2,
                  width: SEAL.size,
                  height: SEAL.size,
                  background: "radial-gradient(closest-side, var(--color-paper), var(--fx-gold) 55%, transparent)",
                }}
                initial={{ opacity: 0, scale: 0.3 }}
                animate={{ opacity: 1, scale: [0.3, 1.7, 1] }}
                transition={{ duration: FX.seal(i).length, delay: since("talismans", FX.seal(i).delay), ease: ease.out }}
              />
            </motion.span>
          ))
        : null}
    </div>
  );
}
