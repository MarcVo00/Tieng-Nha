import thuyTinh from "@/assets/characters/boss-thuy-tinh.svg";
import thuyTinhDefeated from "@/assets/characters/boss-thuy-tinh-defeated.svg";
import bakunawa from "@/assets/characters/boss-bakunawa.svg";
import bakunawaDefeated from "@/assets/characters/boss-bakunawa-defeated.svg";

/** Each boss's art: standing, and its salute once defeated (a bow, never a humiliation). */
const ART: Record<string, { idle: string; defeated: string }> = {
  boss_thuy_tinh: { idle: thuyTinh, defeated: thuyTinhDefeated },
  tl_boss_bakunawa: { idle: bakunawa, defeated: bakunawaDefeated },
};

export type BossArtVariant = "idle" | "defeated";

/** Bundled illustration of a boss sheet (`illustration` key), or null when none is drawn yet. */
export function bossArtUrl(illustration: string, variant: BossArtVariant = "idle"): string | null {
  return ART[illustration]?.[variant] ?? null;
}
