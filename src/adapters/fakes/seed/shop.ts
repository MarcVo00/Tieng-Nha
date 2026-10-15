import type { ShopItem } from "@/domain/types";

/** Same items as src/content/shop.json. */
export const shopFixture: ShopItem[] = [
  { id: "energy_refill", kind: "consumable", slot: null, price: 30 },
  { id: "streak_freeze", kind: "consumable", slot: null, price: 50, maxStock: 2 },
  { id: "frame_bronze", kind: "cosmetic", slot: "frame", price: 40 },
  { id: "frame_jade", kind: "cosmetic", slot: "frame", price: 80 },
  { id: "frame_son_mai", kind: "cosmetic", slot: "frame", price: 150 },
];
