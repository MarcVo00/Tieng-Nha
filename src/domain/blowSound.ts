import { SOUND_CUES, type SoundCue } from "@/domain/sound";
import type { Rarity } from "@/domain/types";

/** The sound family of a weapon: every accessory of the catalogue strikes like one of these (spec sound-and-reveal §4.2). */
export type WeaponFamily = "blade" | "staff" | "fan" | "fist";

/** The family of each accessory of the catalogue. An accessory missing here strikes bare-handed. */
export const WEAPON_FAMILY: Readonly<Record<string, WeaponFamily>> = {
  acc_thuan_thien: "blade",
  acc_giao_tre: "staff", // the bamboo spear
  acc_quat_sat: "fan",
  acc_con_vo: "staff",
};

const CUES: ReadonlySet<string> = new Set(SOUND_CUES);
const isCue = (cue: string): cue is SoundCue => CUES.has(cue);
const signature = (rarity: Rarity | null) => rarity === "epic" || rarity === "legendary";

/** Its own blow sound, for an epic or legendary piece that has one. */
function ownCue(id: string, rarityOf: (id: string) => Rarity | null): SoundCue | null {
  const cue = `blow.${id}`;
  return signature(rarityOf(id)) && isCue(cue) ? cue : null;
}

/**
 * How a fighter's blow sounds, from what it wears (whether the player owns it or not): an epic or legendary weapon
 * has its own sound, any other weapon sounds like its family; bare-handed, an epic or legendary character may have its
 * own sound, anyone else punches.
 */
export function blowCue(
  look: { accessory?: string | null; character?: string | null },
  rarityOf: (id: string) => Rarity | null,
): SoundCue {
  const weapon = look.accessory ?? null;
  if (weapon !== null) {
    const family = WEAPON_FAMILY[weapon];
    const own = ownCue(weapon, rarityOf);
    if (own) return own;
    if (family) return `blow.${family}`;
  }
  const character = look.character ?? null;
  return (character !== null ? ownCue(character, rarityOf) : null) ?? "blow.fist";
}
