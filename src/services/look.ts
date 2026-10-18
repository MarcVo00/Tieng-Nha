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
