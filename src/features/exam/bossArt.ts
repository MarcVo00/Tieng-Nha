import thuyTinh from "@/assets/characters/boss-thuy-tinh.svg";
import thuyTinhDefeated from "@/assets/characters/boss-thuy-tinh-defeated.svg";

/** Each boss's art: standing, and its salute once defeated (a bow, never a humiliation). */
const ART: Record<string, { idle: string; defeated: string }> = { boss_thuy_tinh: { idle: thuyTinh, defeated: thuyTinhDefeated } };

export type BossArtVariant = "idle" | "defeated";

/** Bundled illustration of a boss sheet (`illustration` key), or null when none is drawn yet. */
export function bossArtUrl(illustration: string, variant: BossArtVariant = "idle"): string | null {
  return ART[illustration]?.[variant] ?? null;
}
