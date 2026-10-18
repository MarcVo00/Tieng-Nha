import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { duration } from "@/ui/motion";

export type ProfileFxId = "fx_ink" | "fx_lightning" | "fx_embers";
const PROFILE_FX_IDS: readonly string[] = ["fx_ink", "fx_lightning", "fx_embers"];
export const isProfileFx = (id: string | null | undefined): id is ProfileFxId => id != null && PROFILE_FX_IDS.includes(id);

// The effect layer is an SVG 180 % of the avatar, centred on it (viewBox 100, avatar ring ~ radius 31).
// Everything is a flat shape with a black outline (Dong Ho print); only transform/opacity animate.
const LAYER = "pointer-events-none absolute -inset-[40%]";
const SVG_PROPS = { viewBox: "0 0 100 100", "aria-hidden": true, focusable: false, className: "h-full w-full overflow-visible" } as const;
const ROTATIONS_INK = [0, 120, 240] as const;

function Ink({ animated }: { animated: boolean }) {
  const swirls = (
    <svg {...SVG_PROPS}>
      {ROTATIONS_INK.map((deg) => (
        <g key={deg} transform={`rotate(${deg} 50 50)`}>
          {/* pearl-paper underlay keeps the ink readable on the dark theme */}
          <path d="M26 17 C38 5 62 5 73 15 C79 21 76 29 69 28" className="fill-none stroke-paper" strokeWidth="7.5" strokeLinecap="round" opacity="0.45" />
          <path d="M26 17 C38 5 62 5 73 15 C79 21 76 29 69 28" className="fill-none stroke-fx-ink" strokeWidth="4.6" strokeLinecap="round" opacity="0.4" />
          <path d="M34 11 C44 6 56 6 64 10" className="fill-none stroke-fx-vermilion" strokeWidth="2.6" strokeLinecap="round" />
          <circle cx="69" cy="28" r="3.4" className="fill-fx-vermilion stroke-fx-ink" strokeWidth="1" />
        </g>
      ))}
    </svg>
  );
  if (!animated) return <div className={LAYER}>{swirls}</div>;
  return (
    <motion.div
      data-fx-motion
      className={LAYER}
      animate={{ rotate: 360 }}
      transition={{ duration: duration.loop * 15, ease: "linear", repeat: Infinity }}
    >
      {swirls}
    </motion.div>
  );
}

const BOLTS = [
  { deg: 20, slot: 0 },
  { deg: 140, slot: 1 },
  { deg: 255, slot: 2 },
] as const;
const BOLT_CYCLE = duration.loop * 3;

function Lightning({ animated }: { animated: boolean }) {
  return (
    <div className={LAYER}>
      <svg {...SVG_PROPS}>
        {BOLTS.map(({ deg, slot }) => {
          const shape = (
            <>
              <path d="M55 0 L43 11 L49.5 11 L43 21 L58 8 L51 8 Z" className="fill-fx-gold stroke-fx-ink" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M53 3 L48 9" className="fill-none stroke-paper" strokeWidth="1.1" strokeLinecap="round" />
            </>
          );
          return (
            <g key={deg} transform={`rotate(${deg} 50 50) translate(0 -8) translate(50 10) scale(1.35) translate(-50 -10)`}>
              {animated ? (
                <motion.g
                  data-fx-motion
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 1, 1, 0.2, 1, 0, 0] }}
                  transition={{
                    duration: BOLT_CYCLE,
                    times: [0, 0.04, 0.12, 0.16, 0.2, 0.32, 1],
                    delay: slot * (BOLT_CYCLE / 3),
                    repeat: Infinity,
                    ease: "linear",
                  }}
                >
                  {shape}
                </motion.g>
              ) : (
                <g>{shape}</g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

const EMBERS = [
  { x: 20, y: 60, r: 2.4, c: "fill-fx-vermilion", d: 0, drift: -4 },
  { x: 34, y: 66, r: 1.6, c: "fill-fx-gold", d: 0.35, drift: 5 },
  { x: 46, y: 62, r: 2.2, c: "fill-fx-gold", d: 0.7, drift: -3 },
  { x: 58, y: 68, r: 1.7, c: "fill-fx-vermilion", d: 0.2, drift: 4 },
  { x: 70, y: 62, r: 2.5, c: "fill-fx-gold", d: 0.55, drift: -5 },
  { x: 82, y: 60, r: 1.8, c: "fill-fx-vermilion", d: 0.85, drift: 3 },
  { x: 27, y: 72, r: 1.5, c: "fill-fx-gold", d: 0.95, drift: 4 },
  { x: 76, y: 72, r: 1.6, c: "fill-fx-vermilion", d: 0.1, drift: -4 },
] as const;
const RISE = 58;
const EMBER_CYCLE = duration.loop * 3;

function Embers({ animated }: { animated: boolean }) {
  return (
    <div className={LAYER}>
      <svg {...SVG_PROPS}>
        {EMBERS.map((e) => {
          const dot = <circle cx={e.x} cy={e.y} r={e.r * 1.5} className={`${e.c} stroke-fx-ink`} strokeWidth="1" />;
          return animated ? (
            <motion.g
              key={`${e.x}-${e.y}`}
              data-fx-motion
              initial={{ y: 0, x: 0, opacity: 0 }}
              animate={{ y: [0, -RISE], x: [0, e.drift], opacity: [0, 1, 0.9, 0] }}
              transition={{
                duration: EMBER_CYCLE,
                times: [0, 0.15, 0.7, 1],
                delay: e.d * (EMBER_CYCLE / 3),
                repeat: Infinity,
                ease: "linear",
              }}
            >
              {dot}
            </motion.g>
          ) : (
            // Static pose: embers frozen part-way up.
            <g key={`${e.x}-${e.y}`} transform={`translate(0 ${-RISE / 2 + (e.d - 0.5) * 8})`} opacity="0.9">
              {dot}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Wraps an avatar in a profile effect (behind it). Purely decorative: the layer is aria-hidden and ignores pointer events. */
export function ProfileFx({ id, children }: { id: ProfileFxId; children: ReactNode }) {
  const animated = !useReducedMotion();
  return (
    <span data-fx={id} className="relative inline-flex shrink-0">
      <span aria-hidden="true" className="contents">
        {id === "fx_ink" ? <Ink animated={animated} /> : id === "fx_lightning" ? <Lightning animated={animated} /> : <Embers animated={animated} />}
      </span>
      <span className="relative inline-flex">{children}</span>
    </span>
  );
}
