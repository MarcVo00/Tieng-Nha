import { motion, useReducedMotion } from "motion/react";
import type { Boss } from "@/domain/types";
import { fr } from "@/i18n/fr";
import { duration } from "@/ui";
import { FighterSprite, type FighterControls, type FighterPose } from "@/ui/fight";
import type { Expression } from "@/ui/characterLayers";
import { bossArtUrl } from "@/features/exam/bossArt";

const ART = "pointer-events-none absolute inset-0 h-full w-full select-none";

/** The boss on its paper medallion (docs/art-direction.md §3): the intro's portrait. */
export function BossPortrait({ boss, size, defeated = false }: { boss: Boss; size: number; defeated?: boolean }) {
  const url = bossArtUrl(boss.illustration, defeated ? "defeated" : "idle");
  const art = Math.round(size * 0.86);
  return (
    <div
      role="img"
      aria-label={fr.exam.boss.aria(boss.name, boss.title, defeated)}
      className="flex items-center justify-center overflow-hidden rounded-lg border-2 border-gold bg-paper shadow-card"
      style={{ width: size, height: size }}
    >
      {url ? <img src={url} alt="" draggable={false} style={{ width: art, height: art }} /> : null}
    </div>
  );
}

type BossSpriteProps = {
  illustration: string;
  size: number;
  facing: 1 | -1;
  expression: Expression;
  pose?: FighterPose;
  controls?: FighterControls;
  live?: boolean;
};

/**
 * The boss as a fighter (no medallion): both arts are mounted (decoded before the K.-O.) and swapped on the `ko` face,
 * instantly — under reduced motion they cross-fade instead. The boss has no hurt art: the paper flash marks the hit.
 * Decorative: the caller labels it.
 */
export function BossSprite({ illustration, size, facing, expression, pose = "stand", controls, live = false }: BossSpriteProps) {
  const reduced = useReducedMotion() === true;
  const idle = bossArtUrl(illustration, "idle");
  const defeated = bossArtUrl(illustration, "defeated") ?? idle;
  const shown = expression === "ko" ? "defeated" : "idle";
  return (
    <span data-fighter="boss" className="block">
      <FighterSprite facing={facing} expression={expression} size={size} ratio={1} pose={pose} live={live} {...(controls ? { controls } : {})}>
        {[
          ["idle", idle],
          ["defeated", defeated],
        ].map(([art, src]) =>
          src ? (
            reduced ? (
              <motion.img
                key={art}
                src={src}
                alt=""
                draggable={false}
                data-art={art}
                className={ART}
                initial={false}
                animate={{ opacity: art === shown ? 1 : 0 }}
                transition={{ duration: duration.fast }}
              />
            ) : (
              <img key={art} src={src} alt="" draggable={false} data-art={art} className={`${ART} ${art === shown ? "" : "invisible"}`} />
            )
          ) : null,
        )}
      </FighterSprite>
    </span>
  );
}
