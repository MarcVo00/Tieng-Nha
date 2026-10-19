import type { ShopItem } from "@/domain/types";

/** Same items as src/content/shop.json. */
export const shopFixture: ShopItem[] = [
  { id: "energy_refill", kind: "consumable", slot: null, price: 30, currency: "xu" },
  { id: "streak_freeze", kind: "consumable", slot: null, price: 50, maxStock: 2, currency: "xu" },
  { id: "frame_bronze", kind: "cosmetic", slot: "frame", price: null, currency: "xu" },
  { id: "frame_jade", kind: "cosmetic", slot: "frame", price: null, currency: "xu" },
  { id: "frame_son_mai", kind: "cosmetic", slot: "frame", price: null, currency: "xu" },
  { id: "fx_ink", kind: "cosmetic", slot: "profile_fx", price: null, currency: "xu" },
  { id: "fx_lightning", kind: "cosmetic", slot: "profile_fx", price: null, currency: "xu" },
  { id: "fx_embers", kind: "cosmetic", slot: "profile_fx", price: null, currency: "xu" },
  { id: "hat_thuy_tinh", kind: "cosmetic", slot: "hat", price: 60, theme: "legendes_sombres", currency: "xu" },
  { id: "aura_waves", kind: "cosmetic", slot: "aura", price: 80, theme: "legendes_sombres", currency: "xu" },
  { id: "outfit_son_tinh", kind: "cosmetic", slot: "outfit", price: 90, theme: "legendes_sombres", currency: "xu" },
  { id: "acc_thuan_thien", kind: "cosmetic", slot: "accessory", price: 120, theme: "legendes_sombres", currency: "xu" },
  { id: "char_kiem_khach", kind: "cosmetic", slot: "character", price: 200, currency: "xu" },
  { id: "char_phap_su", kind: "cosmetic", slot: "character", price: 200, currency: "xu" },
  { id: "hat_tay_son", kind: "cosmetic", slot: "hat", price: 6, theme: "arene", currency: "kim_bai" },
  { id: "acc_con_vo", kind: "cosmetic", slot: "accessory", price: 8, theme: "arene", currency: "kim_bai" },
  { id: "outfit_hoi_vat", kind: "cosmetic", slot: "outfit", price: 10, theme: "arene", currency: "kim_bai" },
];
