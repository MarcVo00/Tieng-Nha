import type { ShopItem } from "@/domain/types";

/** Same items as src/content/shop.json. */
export const shopFixture: ShopItem[] = [
  { id: "energy_refill", kind: "consumable", slot: null, price: 30 },
  { id: "streak_freeze", kind: "consumable", slot: null, price: 50, maxStock: 2 },
  { id: "frame_bronze", kind: "cosmetic", slot: "frame", price: null },
  { id: "frame_jade", kind: "cosmetic", slot: "frame", price: null },
  { id: "frame_son_mai", kind: "cosmetic", slot: "frame", price: null },
  { id: "fx_ink", kind: "cosmetic", slot: "profile_fx", price: null },
  { id: "fx_lightning", kind: "cosmetic", slot: "profile_fx", price: null },
  { id: "fx_embers", kind: "cosmetic", slot: "profile_fx", price: null },
  { id: "hat_thuy_tinh", kind: "cosmetic", slot: "hat", price: 60, theme: "legendes_sombres" },
  { id: "aura_waves", kind: "cosmetic", slot: "aura", price: 80, theme: "legendes_sombres" },
  { id: "outfit_son_tinh", kind: "cosmetic", slot: "outfit", price: 90, theme: "legendes_sombres" },
  { id: "acc_thuan_thien", kind: "cosmetic", slot: "accessory", price: 120, theme: "legendes_sombres" },
];
