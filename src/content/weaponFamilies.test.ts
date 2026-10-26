import shop from "@/content/shop.json";
import { ShopFileSchema } from "@/content/schema";
import { WEAPON_FAMILY } from "@/domain/blowSound";

test("every accessory of the catalogue has a weapon family, so it strikes with its own sound", () => {
  const accessories = ShopFileSchema.parse(shop).items.filter((i) => i.slot === "accessory").map((i) => i.id);
  expect(accessories.length).toBeGreaterThan(0);
  expect(accessories.filter((id) => WEAPON_FAMILY[id] === undefined)).toEqual([]);
});
