import { motion } from "motion/react";
import heroUrl from "@/assets/characters/hero-base.svg";
import { spring } from "@/ui";
import type { HeroPlacement } from "@/features/home/pathLayout";

const MEDALLION = 46; // px, round paper medallion (docs/art-direction.md §3)
const TIP = 7; // px, the point that rests on the stop
const SINK = 6; // px the piece sits into the stop, so it clears the dialogue bubble above

// The learner's hero as a game piece: a paper medallion with a point resting on the stop of the last lesson
// completed (or beside lesson 1 before the first one). Purely visual: taps go through to the stop underneath.
export function HeroToken({ hero, label }: { hero: HeroPlacement; label: string }) {
  return (
    <motion.div
      role="img"
      aria-label={label}
      className="pointer-events-none absolute z-10 flex flex-col items-center"
      style={{ left: hero.x - MEDALLION / 2, top: hero.y + (hero.at ? SINK : 0) - MEDALLION - TIP, width: MEDALLION }}
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring.soft}
    >
      <span className="flex items-center justify-center overflow-hidden rounded-full border-2 border-gold bg-paper shadow-card" style={{ width: MEDALLION, height: MEDALLION }}>
        <img src={heroUrl} alt="" width={32} height={43} className="mt-1" draggable={false} />
      </span>
      <span aria-hidden="true" className="h-0 w-0 border-x-[6px] border-t-[7px] border-x-transparent border-t-gold" />
    </motion.div>
  );
}
