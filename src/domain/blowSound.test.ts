import { blowCue, WEAPON_FAMILY } from "@/domain/blowSound";
import type { Rarity } from "@/domain/types";

const RARITY: Record<string, Rarity> = {
  acc_thuan_thien: "epic",
  acc_quat_sat: "rare",
  acc_giao_tre: "common",
  char_phap_su: "legendary",
  char_kiem_khach: "epic",
  acc_kiem_rong: "legendary",
  char_ho_ly: "legendary",
  char_lac_long_quan: "legendary",
  char_thay_phap: "epic",
};
const rarityOf = (id: string): Rarity | null => RARITY[id] ?? null;

test("an epic weapon with its own sound rings it", () => {
  expect(blowCue({ accessory: "acc_thuan_thien", character: null }, rarityOf)).toBe("blow.acc_thuan_thien");
});

test("common, rare and unrated weapons sound like their family", () => {
  expect(blowCue({ accessory: "acc_quat_sat", character: null }, rarityOf)).toBe("blow.fan");
  expect(blowCue({ accessory: "acc_con_vo", character: null }, rarityOf)).toBe("blow.staff");
  expect(blowCue({ accessory: "acc_giao_tre", character: null }, rarityOf)).toBe("blow.staff");
});

test("the weapon wins over the character's bare hands", () => {
  expect(blowCue({ accessory: "acc_quat_sat", character: "char_phap_su" }, rarityOf)).toBe("blow.fan");
});

test("bare hands: an epic or legendary character with its own sound rings it, anyone else punches", () => {
  expect(blowCue({ accessory: null, character: "char_phap_su" }, rarityOf)).toBe("blow.char_phap_su");
  expect(blowCue({ accessory: null, character: "char_kiem_khach" }, rarityOf)).toBe("blow.char_kiem_khach");
  expect(blowCue({ accessory: null, character: "char_base" }, rarityOf)).toBe("blow.fist");
  expect(blowCue({ accessory: null, character: null }, rarityOf)).toBe("blow.fist");
  expect(blowCue({}, rarityOf)).toBe("blow.fist");
});

test("a signature sound needs the rarity: unknown to the catalogue (still loading), the family or the fist plays", () => {
  const none = () => null;
  expect(blowCue({ accessory: "acc_thuan_thien", character: null }, none)).toBe("blow.blade");
  expect(blowCue({ accessory: null, character: "char_phap_su" }, none)).toBe("blow.fist");
});

test("an unknown accessory is bare hands", () => {
  expect(blowCue({ accessory: "acc_inconnu", character: null }, rarityOf)).toBe("blow.fist");
});

test("every weapon family has a blow sound", () => {
  expect(WEAPON_FAMILY).toMatchObject({ acc_giao_tre: "staff", acc_quat_sat: "fan", acc_con_vo: "staff", acc_thuan_thien: "blade" });
});

test("the new gear: the oar, trident and lantern pole are staves, the paper fan is a fan", () => {
  expect(WEAPON_FAMILY).toMatchObject({ acc_mai_cheo: "staff", acc_dinh_ba: "staff", acc_long_den: "staff", acc_quat_giay: "fan" });
});

test("the dragon sword and the new legendary characters ring their own sound", () => {
  expect(blowCue({ accessory: "acc_kiem_rong", character: null }, rarityOf)).toBe("blow.acc_kiem_rong");
  expect(blowCue({ accessory: null, character: "char_ho_ly" }, rarityOf)).toBe("blow.char_ho_ly");
  expect(blowCue({ accessory: null, character: "char_lac_long_quan" }, rarityOf)).toBe("blow.char_lac_long_quan");
});

test("the dragon sword falls back to the blade while the catalogue loads; Thầy pháp, epic, keeps the fist", () => {
  expect(blowCue({ accessory: "acc_kiem_rong", character: null }, () => null)).toBe("blow.blade");
  expect(blowCue({ accessory: null, character: "char_thay_phap" }, rarityOf)).toBe("blow.fist");
});
