import thuyTinh from "@/assets/characters/boss-thuy-tinh.svg";
import bakunawa from "@/assets/characters/boss-bakunawa.svg";
import sonTinh from "@/assets/characters/boss-son-tinh.svg";
import tikbalang from "@/assets/characters/boss-tikbalang.svg";

const ART: Record<string, string> = { boss_thuy_tinh: thuyTinh, tl_boss_bakunawa: bakunawa, boss_son_tinh: sonTinh, tl_boss_tikbalang: tikbalang };

/** Bundled illustration of a boss sheet (`illustration` key), or null when none is drawn yet. */
export function bossArtUrl(illustration: string): string | null {
  return ART[illustration] ?? null;
}
