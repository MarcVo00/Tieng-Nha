import { motion } from "motion/react";
import type { Look } from "@/domain/types";
import { Character, spring } from "@/ui";
import type { HeroPlacement } from "@/features/home/pathLayout";

const MEDALLION = 46; // px, round paper medallion (docs/art-direction.md §3)
const CHARACTER = 60; // px wide; the circle crops to head and hat, like Avatar
const TIP = 7; // px, the point that rests on the stop
const SINK = 6; // px the piece sits into the stop, so it clears the dialogue bubble above

// The learner's hero as a game piece: a paper medallion with a point resting on the stop of the last lesson
// completed (or beside lesson 1 before the first one). Purely visual: taps go through to the stop underneath.
export function HeroToken({ hero, label, look }: { hero: HeroPlacement; label: string; look: Look }) {
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
      <span className="relative flex items-center justify-center overflow-hidden rounded-full border-2 border-gold bg-paper shadow-card" style={{ width: MEDALLION, height: MEDALLION }}>
        <span className="absolute" style={{ left: (MEDALLION - CHARACTER) / 2, top: MEDALLION * 0.5 - CHARACTER * (4 / 3) * 0.4375 }}>
          <Character look={look} size={CHARACTER} />
        </span>
      </span>
      <span aria-hidden="true" className="h-0 w-0 border-x-[6px] border-t-[7px] border-x-transparent border-t-gold" />
    </motion.div>
  );
}
