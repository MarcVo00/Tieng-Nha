import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { useServices } from "@/app/ServicesProvider";
import { ease } from "@/ui";
import lanternSrc from "@/assets/gacha/lantern.svg?url";
import smokeSrc from "@/assets/gacha/lantern-smoke.svg?url";
import tailSrc from "@/assets/gacha/foxfire-tail.svg?url";
import foxSrc from "@/assets/gacha/ink-fox-silhouette.svg?url";
import eyesSrc from "@/assets/gacha/ink-fox-eyes.svg?url";
import sparksSrc from "@/assets/gacha/foxfire-sparks.svg?url";
import type { SignatureProps } from "@/features/shop/signatures/types";
import {
  BOX,
  DARK,
  darkKeys,
  FOX,
  foxCues,
  FX,
  LANTERN,
  lanternOutAt,
  LANTERNS,
  LIGHT,
  lightKeys,
  MOUNTED,
  ROOT,
  SIG,
  SMOKE,
  TAIL,
  TAILS,
  type Beat,
} from "@/features/shop/signatures/foxSchedule";

// La renarde à neuf queues (spec more-banners §4.4), ≈ 3.3 s: four lanterns hang lit over the altar as dusk falls; one
// by one they gutter and go out, each with a breath and a curl of smoke, and the dark deepens a step each time; in the
// dark a cold blue fire catches behind an ink silhouette and nine tails of it sweep out in a fan, the middle one first,
// crackling; a ring of bells, her gold eyes snap open, the fire blazes, the dark lifts round her and she gives way to
// the scroll. Every beat and sound runs on timers from one pure schedule, never on animation callbacks; delays and
// lengths come from `FX`; transform/opacity only, ≤ 16 animated at once (tested), no loop, everything unmounted at the
// end.

const ms = (s: number) => Math.round(s * 1000);
const BEATS = Object.keys(MOUNTED) as Beat[];
const DARK_KEYS = darkKeys();
const LIGHT_KEYS = LANTERNS.map((_, i) => lightKeys(i));
/**
 * Easing of the keyframed beats that hold a value (the dark, the halos, the glow). Opacity runs on the compositor
 * (WAAPI), where one easing spans the whole timeline and would squash every hold into its first moments; the holds are
 * written into the keyframes, so they run linear between them.
 */
const HELD = "linear";
/** The glow's keyframe offsets over `FX.glow`: the fire catches, the fan is out, the bells, the peak, the dark lifted, the end. */
const GLOW_TIMES = [SIG.fan, SIG.fanned, SIG.bells, SIG.blazed, SIG.lifted, SIG.end].map(
  (t) => (t - SIG.fan) / FX.glow.length,
);
const GLOW = 288;
/** Her eyes, in her box (ink-fox-eyes.svg draws them at 72 of 160). */
const EYES_Y = 72 / 160;
const CHIME = 236;
const SPARKS = { w: 240, h: 170, x: 8, y: 30 } as const;
/** Lift: the dark holds at the bells until the fire peaks, then lifts. */
const LIFT_TIMES = [0, (SIG.blazed - SIG.bells) / (SIG.lifted - SIG.bells), 1];

export function NineTailFox({ onEnd, reduced }: SignatureProps) {
  const { sound } = useServices();
  // The end is read at its time, so a new `onEnd` identity never restarts the scene.
  const end = useRef(onEnd);
  end.current = onEnd;
  // What is on screen from the first frame (the lanterns, lit); the rest mounts on its timer.
  const [on, setOn] = useState<ReadonlySet<Beat>>(() => new Set(BEATS.filter((b) => MOUNTED[b].from === 0)));
  const [rung, setRung] = useState(false);

  useEffect(() => {
    if (reduced) {
      end.current();
      return undefined;
    }
    const timers: number[] = [];
    const at = (s: number, run: () => void) => timers.push(window.setTimeout(run, ms(s)));
    for (const c of foxCues()) at(c.at, () => sound.play(c.cue));
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
    at(SIG.bells, () => setRung(true));
    at(SIG.end, () => end.current());
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [reduced, sound]);

  if (reduced) return null;
  const since = (beat: Beat, at: number) => at - MOUNTED[beat].from; // a delay, from the element's own mount
  return (
    <div
      aria-hidden="true"
      data-signature="char_ho_ly"
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ width: BOX.w, height: BOX.h }}
    >
      {/* The lanterns hang over the altar, under the dark: as it deepens, the dead ones sink into it. */}
      {on.has("lanterns") ? (
        <motion.span
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: FX.lanternsIn.length, ease: ease.out }}
        >
          {LANTERNS.map((l, i) => (
            <span key={i}>
              <span
                className="absolute bg-fx-ink"
                style={{ left: l.x + LANTERN.w / 2 - 0.75, top: 0, width: 1.5, height: l.y + 2 }}
              />
              <img
                data-fx="fox-lantern"
                src={lanternSrc}
                alt=""
                draggable={false}
                className="absolute max-w-none select-none"
                style={{ left: l.x, top: l.y, width: LANTERN.w, height: LANTERN.h }}
              />
            </span>
          ))}
        </motion.span>
      ) : null}
      {/* Night falls, and each lantern's death takes a step of it; it lifts round her once her fire has peaked. */}
      <motion.span
        className="absolute inset-0 bg-fx-ink"
        initial={{ opacity: 0 }}
        animate={{ opacity: rung ? [DARK, DARK, 0] : DARK_KEYS.opacity }}
        transition={
          rung
            ? { duration: SIG.lifted - SIG.bells, times: LIFT_TIMES, ease: HELD }
            : { duration: FX.darken.length, times: DARK_KEYS.times, ease: HELD }
        }
      />
      {/* The lanterns' light, over the dark: each halo holds, gutters, flickers once and dies with its breath. */}
      {on.has("lights")
        ? LANTERNS.map((l, i) => (
            <motion.span
              key={i}
              data-fx="fox-light"
              className="absolute rounded-full"
              style={{
                left: l.x + LANTERN.w / 2 - LIGHT / 2,
                top: l.y + LANTERN.h / 2 - LIGHT / 2,
                width: LIGHT,
                height: LIGHT,
                background:
                  "radial-gradient(closest-side, var(--color-paper), var(--fx-gold) 34%, transparent)",
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: LIGHT_KEYS[i]?.opacity ?? 0 }}
              transition={{
                duration: FX.light(i).length,
                delay: since("lights", FX.light(i).delay),
                times: LIGHT_KEYS[i]?.times,
                ease: HELD,
              }}
            />
          ))
        : null}
      {/* The breath: a curl of smoke rises from each lantern as it dies. */}
      {on.has("smoke")
        ? LANTERNS.map((l, i) => (
            <motion.img
              key={i}
              data-fx="fox-smoke"
              src={smokeSrc}
              alt=""
              draggable={false}
              className="absolute max-w-none select-none"
              style={{
                left: l.x + LANTERN.w / 2 - SMOKE.w / 2,
                top: l.y + 6 - SMOKE.h,
                width: SMOKE.w,
                height: SMOKE.h,
                transformOrigin: "50% 100%",
              }}
              initial={{ opacity: 0, y: 4, scale: 0.7 }}
              animate={{ opacity: [0, 0.85, 0], y: [4, -10, -26], scale: [0.7, 1, 1.25] }}
              transition={{
                duration: FX.smoke(i).length,
                delay: since("smoke", lanternOutAt(i)),
                times: [0, 0.3, 1],
                ease: HELD,
              }}
            />
          ))
        : null}
      {on.has("fox") ? (
        <>
          {/* The cold glow her fire throws behind her: it catches, holds, blazes at the bells, and fades. */}
          <motion.span
            data-fx="fox-glow"
            className="absolute rounded-full"
            style={{
              left: ROOT.x - GLOW / 2,
              top: ROOT.y - 40 - GLOW / 2,
              width: GLOW,
              height: GLOW,
              background:
                "radial-gradient(closest-side, var(--color-paper), var(--fx-foxfire) 26%, transparent)",
            }}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: [0, 0.55, 0.55, 0.95, 0.7, 0], scale: [0.5, 1, 1, 1.15, 1.2, 1.25] }}
            transition={{
              duration: FX.glow.length,
              delay: since("fox", FX.glow.delay),
              times: GLOW_TIMES,
              ease: HELD,
            }}
          />
          {/* She, her tails and her eyes give way to the scroll together. */}
          <motion.span
            className="absolute inset-0"
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{
              duration: FX.handOver.length,
              delay: since("fox", FX.handOver.delay),
              ease: ease.out,
            }}
          >
            {/* The fan of tails flares once with the bells. */}
            <motion.span
              className="absolute inset-0"
              style={{ transformOrigin: `${ROOT.x}px ${ROOT.y}px` }}
              initial={{ scale: 1 }}
              animate={{ scale: [1, 1.1, 1.04] }}
              transition={{ duration: FX.flare.length, delay: since("fox", FX.flare.delay), ease: ease.out }}
            >
              {on.has("tails")
                ? TAILS.map((t, j) => (
                    <motion.img
                      key={j}
                      data-fx="fox-tail"
                      src={tailSrc}
                      alt=""
                      draggable={false}
                      className="absolute max-w-none select-none"
                      style={{
                        left: ROOT.x - TAIL.w / 2,
                        top: ROOT.y - TAIL.h,
                        width: TAIL.w,
                        height: TAIL.h,
                        transformOrigin: "50% 100%",
                      }}
                      // The art curls to the right; a tail on her left is its mirror (motion rotates before it mirrors, so
                      // it turns by |angle| and the mirror sends it left, curling outward like the body art's tails).
                      initial={{ rotate: 0, scale: 0.2, scaleX: t.angle < 0 ? -1 : 1, opacity: 0 }}
                      // It sweeps past its place and settles back, like a flame thrown out.
                      animate={{
                        rotate: [0, Math.abs(t.angle) * 1.1, Math.abs(t.angle)],
                        scale: [0.2, t.scale * 1.06, t.scale],
                        scaleX: t.angle < 0 ? -1 : 1,
                        opacity: [0, 1, 1],
                      }}
                      transition={{
                        duration: FX.tail(j).length,
                        delay: since("tails", FX.tail(j).delay),
                        times: [0, 0.65, 1],
                        ease: [ease.out, ease.inOut],
                      }}
                    />
                  ))
                : null}
            </motion.span>
            {/* She stands out of the dark, an ink silhouette rimmed by the fire behind her. */}
            <motion.img
              data-fx="fox-silhouette"
              src={foxSrc}
              alt=""
              draggable={false}
              className="absolute max-w-none select-none"
              style={{ left: FOX.x, top: FOX.y, width: FOX.w, height: FOX.h }}
              initial={{ opacity: 0, y: 10, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                duration: FX.silhouette.length,
                delay: since("fox", FX.silhouette.delay),
                ease: ease.out,
              }}
            />
            {/* With the bells, her gold eyes snap open. */}
            <motion.img
              data-fx="fox-eyes"
              src={eyesSrc}
              alt=""
              draggable={false}
              className="absolute max-w-none select-none"
              style={{
                left: FOX.x,
                top: FOX.y,
                width: FOX.w,
                height: FOX.h,
                transformOrigin: `50% ${EYES_Y * 100}%`,
              }}
              initial={{ opacity: 0, scaleY: 0.1 }}
              animate={{ opacity: 1, scaleY: 1 }}
              transition={{ duration: FX.eyes.length, delay: since("fox", FX.eyes.delay), ease: ease.out }}
            />
          </motion.span>
        </>
      ) : null}
      {/* Cold sparks crackle off the tails as they fan out. */}
      {on.has("sparks") ? (
        <motion.img
          data-fx="fox-sparks"
          src={sparksSrc}
          alt=""
          draggable={false}
          className="absolute max-w-none select-none"
          style={{
            left: SPARKS.x,
            top: SPARKS.y,
            width: SPARKS.w,
            height: SPARKS.h,
            transformOrigin: `${ROOT.x - SPARKS.x}px ${ROOT.y - SPARKS.y}px`,
          }}
          initial={{ opacity: 0, scale: 0.7, y: 10 }}
          animate={{ opacity: [0, 1, 1, 0], scale: [0.7, 1, 1.1, 1.15], y: [10, 0, -10, -18] }}
          transition={{ duration: FX.sparks.length, times: [0, 0.2, 0.6, 1], ease: HELD }}
        />
      ) : null}
      {/* The ring of bells: a ring of cold light goes out from her. */}
      {on.has("chime") ? (
        <motion.span
          data-fx="fox-chime"
          className="absolute rounded-full"
          style={{
            left: ROOT.x - CHIME / 2,
            top: FOX.y + EYES_Y * FOX.h - CHIME / 2,
            width: CHIME,
            height: CHIME,
            background:
              "radial-gradient(closest-side, transparent 70%, var(--fx-foxfire) 84%, transparent 97%)",
          }}
          initial={{ opacity: 0, scale: 0.3 }}
          animate={{ opacity: [0, 0.9, 0], scale: [0.3, 0.9, 1.4] }}
          transition={{ duration: FX.chime.length, times: [0, 0.3, 1], ease: HELD }}
        />
      ) : null}
    </div>
  );
}
