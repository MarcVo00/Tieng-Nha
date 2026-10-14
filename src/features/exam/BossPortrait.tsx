import { useEffect } from "react";
import { motion, useAnimationControls } from "motion/react";
import type { Boss } from "@/domain/types";
import { fr } from "@/i18n/fr";
import { duration, spring } from "@/ui";
import { bossArtUrl } from "@/features/exam/bossArt";

const SHAKE = [0, -8, 8, -5, 5, 0];

// The boss on its paper medallion (docs/art-direction.md §3). Shakes on every hit, bows when defeated.
export function BossPortrait({ boss, size, hits, defeated }: { boss: Boss; size: number; hits: number; defeated: boolean }) {
  const controls = useAnimationControls();
  const url = bossArtUrl(boss.illustration);
  useEffect(() => {
    if (hits === 0 || defeated) return;
    void controls.start({ x: SHAKE, opacity: [1, 0.6, 1], transition: { duration: duration.base } });
  }, [hits, defeated, controls]);
  useEffect(() => {
    if (defeated) void controls.start({ rotate: -8, y: 6, transition: spring.soft });
  }, [defeated, controls]);
  return (
    <motion.div
      role="img"
      aria-label={fr.exam.boss.aria(boss.name, boss.title, defeated)}
      animate={controls}
      className="flex items-center justify-center overflow-hidden rounded-lg border-2 border-gold bg-paper shadow-card"
      style={{ width: size, height: size }}
    >
      {url ? <img src={url} alt="" width={Math.round(size * 0.86)} height={Math.round(size * 0.86)} draggable={false} /> : null}
    </motion.div>
  );
}
