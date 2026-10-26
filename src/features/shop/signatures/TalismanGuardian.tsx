import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { useServices } from "@/app/ServicesProvider";
import { duration, ease } from "@/ui";
import talismanSrc from "@/assets/gacha/talisman.svg?url";
import silhouetteSrc from "@/assets/gacha/ink-silhouette.svg?url";
import type { SignatureProps } from "@/features/shop/signatures/types";
import { BOX, MOUNTED, SIG, SILHOUETTE, sealAt, TALISMAN, TALISMAN_COUNT, talismanCues, talismanPath, type Beat } from "@/features/shop/signatures/talismanSchedule";

// La gardienne des talismans (spec sound-and-reveal §6.2), ≈ 3.5 s: the card darkens; a gust tears twelve paper
// talismans off the altar and whirls them around it; one by one their seals catch fire, each with a stroke of the brush;
// they close in on an ink silhouette; a last gong, the ink bursts like a blot on the paper, and the Guardian appears
// (the focus view's scroll takes over). Every beat and sound runs on timers from one pure schedule, never on animation
// callbacks; transform/opacity only, ≤ 14 animated at once, no loop, everything unmounted at the end.

const ms = (s: number) => Math.round(s * 1000);
/** Lit seal: the red seal (centre 12, 11 of the 24 x 52 art) burns gold. */
const SEAL = { size: 18, x: TALISMAN.w / 2, y: Math.round((11 / 52) * TALISMAN.h) } as const;
const PATHS = Array.from({ length: TALISMAN_COUNT }, (_, i) => talismanPath(i));
const CENTRE = { x: SILHOUETTE.x + SILHOUETTE.w / 2, y: SILHOUETTE.y + SILHOUETTE.h / 2 } as const;
const BLOT = 240;
/** How dark the card gets. */
const DARK = 0.66;
/** A blot of ink: a lumpy round body and a few drops thrown out of it (static, built once). */
const BLOT_PATH = (() => {
  const c = BLOT / 2;
  const lobes = 11;
  // Rounded lobes of uneven reach (a blot, not a star): a smooth closed curve through midpoints.
  const pts = Array.from({ length: lobes * 2 }, (_, k) => {
    const a = (k / (lobes * 2)) * Math.PI * 2;
    const r = k % 2 === 0 ? 70 + ((k * 37) % 23) : 54 + ((k * 23) % 11);
    return { x: c + Math.cos(a) * r, y: c + Math.sin(a) * r };
  });
  const mid = (i: number) => {
    const p = pts[i % pts.length] ?? { x: c, y: c };
    const q = pts[(i + 1) % pts.length] ?? { x: c, y: c };
    return `${((p.x + q.x) / 2).toFixed(1)} ${((p.y + q.y) / 2).toFixed(1)}`;
  };
  const body = `M${mid(0)} ${pts.map((_, i) => `Q${(pts[(i + 1) % pts.length]?.x ?? c).toFixed(1)} ${(pts[(i + 1) % pts.length]?.y ?? c).toFixed(1)} ${mid(i + 1)}`).join(" ")} Z`;
  const drops = [0.4, 1.3, 2.2, 3.4, 4.3, 5.4].map((a, k) => {
    const r = 92 + (k % 3) * 10;
    const d = 5 + (k % 2) * 3;
    const x = c + Math.cos(a) * r;
    const y = c + Math.sin(a) * r;
    return `M${(x - d).toFixed(1)} ${y.toFixed(1)} a${d} ${d} 0 1 0 ${2 * d} 0 a${d} ${d} 0 1 0 ${-2 * d} 0`;
  });
  return [body, ...drops].join(" ");
})();

export function TalismanGuardian({ onEnd, reduced }: SignatureProps) {
  const { sound } = useServices();
  // The end is read at its time, so a new `onEnd` identity never restarts the scene.
  const end = useRef(onEnd);
  end.current = onEnd;
  const [on, setOn] = useState<ReadonlySet<Beat>>(() => new Set());

  useEffect(() => {
    if (reduced) {
      end.current();
      return undefined;
    }
    const timers: number[] = [];
    const at = (s: number, run: () => void) => timers.push(window.setTimeout(run, ms(s)));
    for (const c of talismanCues()) at(c.at, () => sound.play(c.cue));
    for (const [beat, span] of Object.entries(MOUNTED) as [Beat, { from: number; to: number }][]) {
      at(span.from, () => setOn((s) => new Set(s).add(beat)));
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
  return (
    <div aria-hidden="true" data-signature="char_phap_su" className="pointer-events-none absolute inset-0 overflow-hidden" style={{ width: BOX.w, height: BOX.h }}>
      {/* The card darkens: ink spreads over the paper, and lifts after the gong. */}
      <motion.span
        className="absolute inset-0 bg-fx-ink"
        initial={{ opacity: 0 }}
        animate={{ opacity: burst ? 0 : DARK }}
        transition={burst ? { duration: SIG.lift, delay: duration.fast, ease: ease.inOut } : { duration: SIG.darken, ease: ease.out }}
      />
      {on.has("silhouette") ? (
        <motion.img
          data-fx="silhouette"
          src={silhouetteSrc}
          alt=""
          draggable={false}
          className="absolute select-none"
          style={{ left: SILHOUETTE.x, top: SILHOUETTE.y, width: SILHOUETTE.w, height: SILHOUETTE.h }}
          initial={{ opacity: 0, scale: 0.86 }}
          // It inks in while the talismans close on it, then bursts with the gong.
          animate={burst ? { opacity: 0, scale: 1.14 } : { opacity: 1, scale: 1 }}
          transition={burst ? { scale: { duration: SIG.splash, ease: ease.out }, opacity: { duration: SIG.splash, ease: ease.in } } : { duration: SIG.silhouetteIn, ease: ease.out }}
        />
      ) : null}
      {on.has("talismans")
        ? PATHS.map((p, i) => (
            <motion.span
              key={i}
              data-fx="talisman"
              className="absolute"
              style={{ left: -TALISMAN.w / 2, top: -TALISMAN.h / 2, width: TALISMAN.w, height: TALISMAN.h }}
              initial={{ x: p.x[0] ?? 0, y: p.y[0] ?? 0, rotate: p.rotate[0] ?? 0, scale: p.scale[0] ?? 1, opacity: 0 }}
              animate={{ x: p.x, y: p.y, rotate: p.rotate, scale: p.scale, opacity: p.opacity }}
              transition={{ duration: SIG.gong - SIG.wind, times: p.times, ease: "linear" }}
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
                transition={{ duration: SIG.sealFlash, delay: sealAt(i) - SIG.wind, ease: ease.out }}
              />
            </motion.span>
          ))
        : null}
      {on.has("splash") ? (
        <motion.svg
          data-fx="blot"
          viewBox={`0 0 ${BLOT} ${BLOT}`}
          width={BLOT}
          height={BLOT}
          className="absolute"
          style={{ left: CENTRE.x - BLOT / 2, top: CENTRE.y - BLOT / 2 }}
          initial={{ opacity: 1, scale: 0.25 }}
          animate={{ opacity: 0, scale: 1.3 }}
          transition={{ scale: { duration: SIG.splash, ease: ease.out }, opacity: { duration: SIG.splash, ease: ease.in } }}
        >
          <path d={BLOT_PATH} fill="var(--fx-ink)" />
        </motion.svg>
      ) : null}
    </div>
  );
}
