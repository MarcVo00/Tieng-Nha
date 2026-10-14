import thuyTinh from "@/assets/characters/boss-thuy-tinh.svg";

const ART: Record<string, string> = { boss_thuy_tinh: thuyTinh };

/** Bundled illustration of a boss sheet (`illustration` key), or null when none is drawn yet. */
export function bossArtUrl(illustration: string): string | null {
  return ART[illustration] ?? null;
}
