import type { ShopItem } from "@/domain/types";
import { GACHA, gachaCost, gachaDraw, gachaRates, gachaRefund, pityFromEvents, themeItems } from "@/services/gacha";

// Mirrors supabase/tests/06_gacha_test.sql ("pure rules"): same inputs, same outputs.
const it = (id: string, slot: ShopItem["slot"], rarity: NonNullable<ShopItem["rarity"]>, theme = "legendes_sombres"): ShopItem => ({
  id, kind: "cosmetic", slot, price: null, currency: "xu", theme, rarity,
});
const SHOP: ShopItem[] = [
  it("hat_thuy_tinh", "hat", "rare"), it("aura_waves", "aura", "rare"), it("outfit_son_tinh", "outfit", "epic"),
  it("acc_thuan_thien", "accessory", "epic"), it("char_kiem_khach", "character", "epic"), it("char_phap_su", "character", "legendary"),
  it("acc_giao_tre", "accessory", "common"), it("hat_khan_vanh", "hat", "common"), it("outfit_ao_chen", "outfit", "common"),
  it("aura_suong_mu", "aura", "common"), it("acc_quat_sat", "accessory", "rare"), it("hat_mu_chien", "hat", "rare"),
  { id: "hat_tay_son", kind: "cosmetic", slot: "hat", price: 6, currency: "kim_bai", theme: "arene" },
  { id: "energy_refill", kind: "consumable", slot: null, price: 30, currency: "xu" },
];
const ITEMS = themeItems(SHOP, "legendes_sombres");
const FULL = ITEMS.map((i) => i.id);

const rep = (r1: number, r2: number, n: number) => Array.from({ length: n }, () => [r1, r2]).flat();
const d = (inv: string[], pity: number, n: number, rolls: number[]) => gachaDraw({ pity }, ITEMS, inv, n, rolls);
const seq = (g: ReturnType<typeof d>) => g.items.map((x) => x.itemId + (x.duplicate ? "*" : "")).join(",");
const rar = (g: ReturnType<typeof d>) => g.items.map((x) => x.rarity[0]).join("");
const refunds = (g: ReturnType<typeof d>) => g.items.reduce((a, x) => a + x.refund, 0);

describe("catalogue and constants", () => {
  test("the launch theme has 12 gacha items, 4/4/3/1; arena and consumables are not gacha", () => {
    expect(ITEMS).toHaveLength(12);
    const n = (r: string) => ITEMS.filter((i) => i.rarity === r).length;
    expect([n("common"), n("rare"), n("epic"), n("legendary")]).toEqual([4, 4, 3, 1]);
    expect(themeItems(SHOP, "arene")).toEqual([]);
  });
  test("prices and refunds", () => {
    expect([gachaCost(1), gachaCost(10), gachaCost(2), gachaCost(0)]).toEqual([40, 360, null, null]);
    expect([gachaRefund("common"), gachaRefund("rare"), gachaRefund("epic"), gachaRefund("legendary")]).toEqual([8, 20, 50, 120]);
    expect(GACHA.pityAt).toBe(40);
  });
});

describe("rarity thresholds 0.60 / 0.88 / 0.98", () => {
  test("roll 0 is the first common", () => expect(seq(d([], 0, 1, [0, 0]))).toBe("acc_giao_tre"));
  test.each([[0.5999, "c"], [0.6, "r"], [0.8799, "r"], [0.88, "e"], [0.9799, "e"], [0.98, "l"]])("roll %s -> %s", (r, want) => {
    expect(rar(d([], 0, 1, [r as number, 0]))).toBe(want);
  });
  test("roll 0.9999 is legendary", () => expect(rar(d([], 0, 1, [0.9999, 0.99]))).toBe("l"));
});

describe("item pick = floor(r2 * n) among the rarity sorted by id", () => {
  test.each([
    [0.1, 0.24, "acc_giao_tre"], [0.1, 0.25, "aura_suong_mu"], [0.1, 0.5, "hat_khan_vanh"], [0.1, 0.75, "outfit_ao_chen"], [0.1, 0.9999, "outfit_ao_chen"],
    [0.7, 0.5, "hat_mu_chien"], [0.9, 0.3333, "acc_thuan_thien"], [0.9, 0.34, "char_kiem_khach"], [0.9, 0.67, "outfit_son_tinh"], [0.99, 0.9, "char_phap_su"],
  ])("rolls %s / %s -> %s", (r1, r2, id) => expect(seq(d([], 0, 1, [r1 as number, r2 as number]))).toBe(id));
  test("the order is plain code units, not locale order", () => {
    const odd = [it("b_x", "hat", "common"), it("B_y", "hat", "common"), it("a_z", "hat", "common")];
    expect(gachaDraw({ pity: 0 }, odd, [], 1, [0.1, 0]).items[0]?.itemId).toBe("B_y");
    expect(gachaDraw({ pity: 0 }, odd, [], 1, [0.1, 0.34]).items[0]?.itemId).toBe("a_z");
  });
});

describe("pity", () => {
  test("38: the 39th item is not forced, counter 39", () => {
    const g = d([], 38, 1, [0.1, 0]);
    expect([seq(g), g.pity]).toEqual(["acc_giao_tre", 39]);
  });
  test("39: the 40th item is forced legendary, counter resets", () => {
    const g = d([], 39, 1, [0.1, 0]);
    expect([rar(g), g.pity]).toEqual(["l", 0]);
  });
  test("a counter past 40 is still forced", () => expect(rar(d([], 41, 1, [0.1, 0]))).toBe("l"));
  test("three commons advance the counter by 3", () => expect(d([], 0, 3, rep(0.1, 0, 3)).pity).toBe(3));
  test("any legendary resets the counter", () => expect(d([], 10, 1, [0.99, 0]).pity).toBe(0));
  test("x10 from 35: the 5th item is the 40th, then 5 more commons", () => {
    const g = d([], 35, 10, rep(0.1, 0, 10));
    expect([rar(g), g.pity]).toEqual(["cccclccccc", 5]);
  });
  test("x10 from 30: the 10th item is legendary, not merely rare", () => expect(rar(d([], 30, 10, rep(0.1, 0, 10)))).toBe("cccccccccl"));
  test("ten legendary rolls: ten legendaries", () => expect(rar(d([], 0, 10, rep(0.99, 0, 10)))).toBe("llllllllll"));
  test("null or negative pity counts as 0", () => {
    expect(gachaDraw({ pity: null }, ITEMS, [], 1, [0.1, 0]).pity).toBe(1);
    expect(gachaDraw({ pity: -5 }, ITEMS, [], 1, [0.1, 0]).pity).toBe(1);
  });
});

describe("x10 guarantee", () => {
  test("nine commons force the 10th to rare", () => expect(rar(d([], 0, 10, rep(0.1, 0, 10)))).toBe("cccccccccr"));
  test("the forced rare is picked with the second roll; same-pull repeats are duplicates", () => {
    expect(seq(d([], 0, 10, [...rep(0.1, 0, 9), 0.1, 0.75]))).toBe("acc_giao_tre," + Array(8).fill("acc_giao_tre*").join(",") + ",hat_thuy_tinh");
  });
  test("an epic 10th stays epic", () => expect(rar(d([], 0, 10, [...rep(0.1, 0, 9), 0.95, 0]))).toBe("ccccccccce"));
  test("a rare among the first nine leaves the 10th common", () => expect(rar(d([], 0, 10, [0.7, 0, ...rep(0.1, 0, 9)]))).toBe("rccccccccc"));
  test("a single pull has no guarantee", () => expect(rar(d([], 0, 1, [0.1, 0]))).toBe("c"));
  test("only a x10 has the rare guarantee", () => expect(rar(d([], 0, 3, rep(0.1, 0, 3)))).toBe("ccc"));
});

describe("duplicates and refunds", () => {
  test("an owned common refunds 8", () => {
    const g = d(["acc_giao_tre"], 0, 1, [0.1, 0]);
    expect([seq(g), refunds(g)]).toEqual(["acc_giao_tre*", 8]);
  });
  test("owned rare 20, epic 50, legendary 120, new 0", () => {
    expect(refunds(d(["aura_waves"], 0, 1, [0.7, 0.25]))).toBe(20);
    expect(refunds(d(["acc_thuan_thien"], 0, 1, [0.9, 0]))).toBe(50);
    expect(refunds(d(["char_phap_su"], 0, 1, [0.99, 0]))).toBe(120);
    expect(refunds(d([], 0, 1, [0.1, 0]))).toBe(0);
  });
  test("in-pull duplicates refund too: 8 x 8 (the rare is new)", () => expect(refunds(d([], 0, 10, [...rep(0.1, 0, 9), 0.1, 0.75]))).toBe(64));
  test("a complete set: all ten are duplicates, 9 x 8 + 20", () => expect(refunds(d(FULL, 0, 10, rep(0.1, 0, 10)))).toBe(92));
  test("a complete set can still be pulled", () => expect(seq(d(FULL, 0, 1, [0.99, 0]))).toBe("char_phap_su*"));
  test("extra rolls are ignored", () => {
    expect(d([], 0, 2, [0.1, 0, 0.1, 0]).items).toEqual(d([], 0, 2, [0.1, 0, 0.1, 0, 0.9, 0.9]).items);
  });
  test("too few or non-finite rolls throw", () => {
    expect(() => d([], 0, 2, [0.1, 0])).toThrow();
    expect(() => d([], 0, 1, [0.1, Number.NaN])).toThrow();
    expect(() => d([], 0, 1, [0.1])).toThrow();
  });
});

describe("a rarity missing from the theme steps down, then up", () => {
  const ce = [it("t_c1", "hat", "common", "only_ce"), it("t_e1", "hat", "epic", "only_ce")];
  const e = [it("u_e1", "hat", "epic", "only_e")];
  const g = (items: ShopItem[], pity: number, n: number, rolls: number[]) => gachaDraw({ pity }, items, [], n, rolls);
  test("no rare: step down to common", () => expect([seq(g(ce, 0, 1, [0.7, 0])), rar(g(ce, 0, 1, [0.7, 0]))]).toEqual(["t_c1", "c"]));
  test("no legendary: step down to epic", () => expect([seq(g(ce, 0, 1, [0.99, 0])), rar(g(ce, 0, 1, [0.99, 0]))]).toEqual(["t_e1", "e"]));
  test("epic available: no fallback", () => expect(rar(g(ce, 0, 1, [0.9, 0]))).toBe("e"));
  test("nothing below: step up to the nearest higher rarity", () => expect(rar(g(e, 0, 1, [0.1, 0]))).toBe("e"));
  test("a forced legendary that falls back to epic does not reset the counter", () => expect(g(ce, 39, 1, [0.1, 0]).pity).toBe(40));
  test("x10 with no rare: the forced rare falls back to common", () => expect(rar(g(ce, 0, 10, rep(0.1, 0, 10)))).toBe("cccccccccc"));
  test("a theme without gacha items throws", () => {
    expect(() => gachaDraw({ pity: 0 }, themeItems(SHOP, "arene"), [], 1, [0.1, 0])).toThrow();
  });
});

describe("published rates", () => {
  test("60 / 28 / 10 / 2 percent with the refunds 8 / 20 / 50 / 120", () => {
    expect(gachaRates()).toEqual([
      { rarity: "common", percent: 60, refund: 8 },
      { rarity: "rare", percent: 28, refund: 20 },
      { rarity: "epic", percent: 10, refund: 50 },
      { rarity: "legendary", percent: 2, refund: 120 },
    ]);
  });
});

describe("pityFromEvents", () => {
  const ev = (refId: string, theme: string, rarities: string[]) => ({
    type: "gacha_pulled",
    refId,
    payload: { theme, cost: 40, items: rarities.map((rarity) => ({ itemId: "x", rarity, duplicate: false, refund: 0 })) },
  });
  test("counts items per theme, resets at a legendary, counts a pull id once", () => {
    const events = [ev("a", "t", ["common", "rare"]), ev("a", "t", ["common"]), ev("b", "other", ["epic", "epic"]), ev("c", "t", ["legendary", "common", "common"])];
    expect(pityFromEvents(events, "t")).toBe(2);
    expect(pityFromEvents(events, "other")).toBe(2);
    expect(pityFromEvents(events, "none")).toBe(0);
  });
  test("ignores other events and malformed payloads", () => {
    expect(pityFromEvents([{ type: "item_purchased", refId: "z", payload: {} }, { type: "gacha_pulled", refId: "y", payload: { theme: "t", items: 3 } }], "t")).toBe(0);
  });
});
