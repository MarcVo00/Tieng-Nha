import thuyTinh from "@/assets/characters/boss-thuy-tinh.svg";
import thuyTinhDefeated from "@/assets/characters/boss-thuy-tinh-defeated.svg";
import bakunawa from "@/assets/characters/boss-bakunawa.svg";
import bakunawaDefeated from "@/assets/characters/boss-bakunawa-defeated.svg";
import sonTinh from "@/assets/characters/boss-son-tinh.svg";
import sonTinhDefeated from "@/assets/characters/boss-son-tinh-defeated.svg";
import tikbalang from "@/assets/characters/boss-tikbalang.svg";
import tikbalangDefeated from "@/assets/characters/boss-tikbalang-defeated.svg";

/** Each boss's art: standing, and its salute once defeated (a bow, never a humiliation). */
const ART: Record<string, { idle: string; defeated: string }> = {
  boss_thuy_tinh: { idle: thuyTinh, defeated: thuyTinhDefeated },
  tl_boss_bakunawa: { idle: bakunawa, defeated: bakunawaDefeated },
  boss_son_tinh: { idle: sonTinh, defeated: sonTinhDefeated },
  tl_boss_tikbalang: { idle: tikbalang, defeated: tikbalangDefeated },
};

export type BossArtVariant = "idle" | "defeated";

/** Bundled illustration of a boss sheet (`illustration` key), or null when none is drawn yet. */
export function bossArtUrl(illustration: string, variant: BossArtVariant = "idle"): string | null {
  return ART[illustration]?.[variant] ?? null;
}
