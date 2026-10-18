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
          // A big jagged bolt, tip touching the avatar frame (r ~ 34), ~28 units long.
          const shape = (
            <>
              <path d="M57 -12 L40 4 L49 4 L38 16 L63 -3 L52 -3 Z" className="fill-fx-gold stroke-fx-ink" strokeWidth="2.2" strokeLinejoin="round" />
              <path d="M54 -7 L46 1" className="fill-none stroke-paper" strokeWidth="1.8" strokeLinecap="round" />
            </>
          );
          return (
            <g key={deg} transform={`rotate(${deg} 50 50)`}>
              {animated ? (
                <motion.g
                  data-fx-motion
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 1, 1, 0.3, 1, 1, 0, 0] }}
                  transition={{
                    duration: BOLT_CYCLE,
                    times: [0, 0.03, 0.12, 0.15, 0.18, 0.3, 0.34, 1],
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

// Embers: flame-shaped teardrops (vermilion body, gold core, ink outline). x/y are viewBox positions of the base pose.
const EMBERS = [
  { x: 14, y: 62, s: 1.2, hot: false, d: 0, drift: -5 },
  { x: 86, y: 66, s: 1.1, hot: true, d: 0.3, drift: 6 },
  { x: 26, y: 78, s: 0.9, hot: true, d: 0.55, drift: 4 },
  { x: 74, y: 76, s: 1.3, hot: false, d: 0.8, drift: -5 },
  { x: 8, y: 80, s: 0.8, hot: true, d: 0.15, drift: 3 },
  { x: 92, y: 84, s: 0.85, hot: false, d: 0.65, drift: -3 },
  { x: 50, y: 74, s: 1.2, hot: false, d: 0.4, drift: 5 },
  { x: 38, y: 70, s: 1, hot: true, d: 0.95, drift: -4 },
] as const;
// Rise and drift are in viewBox units (the layer scales with the avatar); the static pose uses the same unit.
const RISE = 72;
const EMBER_CYCLE = duration.loop * 3;

function Ember({ x, y, s, hot }: { x: number; y: number; s: number; hot: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M0 -9 C5 -3 6 3 0 7 C-6 3 -5 -3 0 -9 Z" className={`${hot ? "fill-fx-gold" : "fill-fx-vermilion"} stroke-fx-ink`} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M0 -3 C2.2 0 2.2 2.4 0 3.8 C-2.2 2.4 -2.2 0 0 -3 Z" className={hot ? "fill-paper" : "fill-fx-gold"} />
    </g>
  );
}

function Embers({ animated }: { animated: boolean }) {
  return (
    <div className={LAYER}>
      <svg {...SVG_PROPS}>
        {EMBERS.map((e) =>
          animated ? (
            <motion.g
              key={`${e.x}-${e.y}`}
              data-fx-motion
              initial={{ y: 0, x: 0, opacity: 0 }}
              animate={{ y: [0, -RISE], x: [0, e.drift], opacity: [0, 1, 0.9, 0] }}
              transition={{ duration: EMBER_CYCLE, times: [0, 0.15, 0.7, 1], delay: e.d * (EMBER_CYCLE / 3), repeat: Infinity, ease: "linear" }}
            >
              <Ember {...e} />
            </motion.g>
          ) : (
            // Static pose: embers frozen part-way up.
            <g key={`${e.x}-${e.y}`} transform={`translate(0 ${-RISE / 2 + (e.d - 0.5) * 10})`} opacity="0.95">
              <Ember {...e} />
            </g>
          ),
        )}
      </svg>
    </div>
  );
}

/** Wraps an avatar in a profile effect (behind it); `still` freezes it in its static pose. Purely decorative: the layer is aria-hidden and ignores pointer events. */
export function ProfileFx({ id, children, still = false }: { id: ProfileFxId; children: ReactNode; still?: boolean }) {
  const animated = !useReducedMotion() && !still;
  return (
    <span data-fx={id} className="relative inline-flex shrink-0">
      <span aria-hidden="true" className="contents">
        {id === "fx_ink" ? <Ink animated={animated} /> : id === "fx_lightning" ? <Lightning animated={animated} /> : <Embers animated={animated} />}
      </span>
      <span className="relative inline-flex">{children}</span>
    </span>
  );
}
