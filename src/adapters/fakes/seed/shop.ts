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
  { id: "hat_thuy_tinh", kind: "cosmetic", slot: "hat", price: null, theme: "legendes_sombres", currency: "xu", rarity: "rare" },
  { id: "aura_waves", kind: "cosmetic", slot: "aura", price: null, theme: "legendes_sombres", currency: "xu", rarity: "rare" },
  { id: "outfit_son_tinh", kind: "cosmetic", slot: "outfit", price: null, theme: "legendes_sombres", currency: "xu", rarity: "epic" },
  { id: "acc_thuan_thien", kind: "cosmetic", slot: "accessory", price: null, theme: "legendes_sombres", currency: "xu", rarity: "epic" },
  { id: "char_kiem_khach", kind: "cosmetic", slot: "character", price: null, theme: "legendes_sombres", currency: "xu", rarity: "epic" },
  { id: "char_phap_su", kind: "cosmetic", slot: "character", price: null, theme: "legendes_sombres", currency: "xu", rarity: "legendary" },
  { id: "acc_giao_tre", kind: "cosmetic", slot: "accessory", price: null, theme: "legendes_sombres", currency: "xu", rarity: "common" },
  { id: "hat_khan_vanh", kind: "cosmetic", slot: "hat", price: null, theme: "legendes_sombres", currency: "xu", rarity: "common" },
  { id: "outfit_ao_chen", kind: "cosmetic", slot: "outfit", price: null, theme: "legendes_sombres", currency: "xu", rarity: "common" },
  { id: "aura_suong_mu", kind: "cosmetic", slot: "aura", price: null, theme: "legendes_sombres", currency: "xu", rarity: "common" },
  { id: "acc_quat_sat", kind: "cosmetic", slot: "accessory", price: null, theme: "legendes_sombres", currency: "xu", rarity: "rare" },
  { id: "hat_mu_chien", kind: "cosmetic", slot: "hat", price: null, theme: "legendes_sombres", currency: "xu", rarity: "rare" },
  { id: "hat_tay_son", kind: "cosmetic", slot: "hat", price: 6, theme: "arene", currency: "kim_bai" },
  { id: "acc_con_vo", kind: "cosmetic", slot: "accessory", price: 8, theme: "arene", currency: "kim_bai" },
  { id: "outfit_hoi_vat", kind: "cosmetic", slot: "outfit", price: 10, theme: "arene", currency: "kim_bai" },
];
