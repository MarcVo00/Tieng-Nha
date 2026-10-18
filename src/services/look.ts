import type { ItemSlot, Look } from "@/domain/types";

const LOOK_SLOTS = ["hat", "outfit", "accessory", "aura"] as const;

/** The character slots of an equipped map; profile slots (frame, profile_fx) are dropped. */
export function lookOf(equipped: Partial<Record<ItemSlot, string>>): Look {
  const look: Look = {};
  for (const slot of LOOK_SLOTS) {
    const id = equipped[slot];
    if (typeof id === "string") look[slot] = id;
  }
  return look;
}

export const CHARACTER_SLOTS = LOOK_SLOTS;
export type CharacterSlot = (typeof LOOK_SLOTS)[number];

/** The character slot of a catalogue item, or null for profile items (frame, profile_fx) and items without a slot. */
export function characterSlotOf(item: { slot: ItemSlot | null }): CharacterSlot | null {
  return LOOK_SLOTS.find((s) => s === item.slot) ?? null;
}
