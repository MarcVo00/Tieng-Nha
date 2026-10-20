import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { duration, ease, spring } from "@/ui/motion";

/** stand: fighting; bow: defeated, the hat falls; salute: a draw or a master's salute, the hat stays on. */
export type FighterPose = "stand" | "bow" | "salute";

/** Bow poses, rotated from the feet towards the opponent (`dir` = the side the fighter faces). Defeat is a bow, never a fall. */
export const BOW = {
  stand: { rotate: 0, y: 0 },
  bow: (dir: 1 | -1) => ({ rotate: 18 * dir, y: 10 }),
  salute: (dir: 1 | -1) => ({ rotate: 12 * dir, y: 6 }),
} as const;
/**
 * Where the hat ends: it slides off and fades. Under reduced motion it simply lies on the ground behind the fighter,
 * clear of the bowed body, unrotated.
 */
export const HAT = {
  on: { x: 0, y: 0, rotate: 0, opacity: 1 },
  fallen: (dir: 1 | -1) => ({ x: 16 * dir, y: 40, rotate: 60 * dir, opacity: 0 }),
  beside: (dir: 1 | -1) => ({ x: -40 * dir, y: 74, rotate: 0, opacity: 1 }),
} as const;

type KoBowProps = {
  pose: FighterPose;
  dir: 1 | -1;
  /** The hat layer, on its own so it can fall. */
  hat?: ReactNode;
  /** Layers drawn above the hat (accessory). */
  over?: ReactNode;
  /** Layers below the hat. */
  children: ReactNode;
};

/** The fighter's bow: rotates from the feet (spring.soft) and drops the hat layer (`y` + `rotate` + fade). */
export function KoBow({ pose, dir, hat, over, children }: KoBowProps) {
  const reduced = useReducedMotion() === true;
  const body = pose === "bow" ? BOW.bow(dir) : pose === "salute" ? BOW.salute(dir) : BOW.stand;
  const hatAt = pose !== "bow" ? HAT.on : reduced ? HAT.beside(dir) : HAT.fallen(dir);
  const instant = { duration: 0 };
  return (
    <motion.span data-pose={pose} className="absolute inset-0 origin-bottom" initial={false} animate={body} transition={reduced ? instant : spring.soft}>
      {children}
      {hat ? (
        <motion.span
          data-hat={pose === "bow" ? "fallen" : "on"}
          className="absolute inset-0"
          initial={false}
          animate={hatAt}
          transition={
            reduced || pose !== "bow"
              ? instant
              : {
                  x: { duration: duration.slow, ease: ease.out },
                  y: { duration: duration.slow, ease: ease.in },
                  rotate: { duration: duration.slow, ease: ease.out },
                  opacity: { duration: duration.slow, delay: duration.base, ease: ease.in },
                }
          }
        >
          {hat}
        </motion.span>
      ) : null}
      {over}
    </motion.span>
  );
}
