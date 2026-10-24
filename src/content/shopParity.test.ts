import { readdirSync, readFileSync } from "node:fs";
import shop from "@/content/shop.json";
import badges from "@/content/badges.json";
import { ShopFileSchema } from "@/content/schema";

const DIR = "supabase/migrations";

/** Newest migration (by file name) that defines `public.<fnName>`. */
function latestMigrationDefining(fnName: string): string {
  const files = readdirSync(DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .reverse();
  for (const f of files) {
    const text = readFileSync(`${DIR}/${f}`, "utf8");
    if (new RegExp(`create (or replace )?function public[.]${fnName}[^a-z_]`).test(text)) return text;
  }
  throw new Error(`no migration defines ${fnName}`);
}

/** Body of the `values (...)` list of a function. */
function valuesOf(sql: string, fnName: string): string {
  const start = sql.indexOf(`function public.${fnName}`);
  const from = sql.indexOf("(values", start);
  const to = sql.indexOf(") as v", from);
  return sql.slice(from, to);
}

// Rows look like: ('hat_thuy_tinh', null::int, 'cosmetic', 'hat', 'xu', 'legendes_sombres', 'rare')
// or ('energy_refill', 30, 'consumable', null::text, 'xu', null::text, null::text)
function shopRows() {
  const body = valuesOf(latestMigrationDefining("shop_items"), "shop_items");
  const text = String.raw`(?:'([a-z_]+)'|null(?:::text)?)`;
  const row = new RegExp(String.raw`\(\s*'([a-z_]+)'\s*,\s*(\d+|null(?:::int)?)\s*,\s*'(consumable|cosmetic)'\s*,\s*${text}\s*,\s*'(xu|kim_bai)'\s*,\s*${text}\s*,\s*${text}\s*\)`, "g");
  return [...body.matchAll(row)].map((m) => ({
    id: m[1],
    price: m[2]!.startsWith("null") ? null : Number(m[2]),
    kind: m[3],
    slot: m[4] ?? null,
    currency: m[5],
    theme: m[6] ?? null,
    rarity: m[7] ?? null,
  }));
}

function rewardRows() {
  const body = valuesOf(latestMigrationDefining("badge_reward"), "badge_reward");
  return [...body.matchAll(/\(\s*'([a-z0-9_]+)'\s*,\s*'([a-z_]+)'\s*\)/g)].map((m) => ({ badge: m[1] ?? "", item: m[2] ?? "" }));
}

describe("catalogue parity with the SQL migrations", () => {
  test("shop_item rows equal shop.json items", () => {
    const fromJson = shop.items.map((i) => ({
      id: i.id,
      price: i.price,
      kind: i.kind,
      slot: i.slot,
      currency: "currency" in i ? i.currency : "xu",
      theme: "theme" in i ? i.theme : null,
      rarity: "rarity" in i ? i.rarity : null,
    }));
    const rows = shopRows();
    expect(rows).toHaveLength(fromJson.length);
    expect(rows).toEqual(fromJson);
  });

  test("shop.json parses with the schema", () => {
    expect(ShopFileSchema.safeParse(shop).success).toBe(true);
  });

  test("the gacha theme has 12 items: 4 common, 4 rare, 3 epic, 1 legendary, none directly purchasable", () => {
    const gacha = shop.items.filter((i) => "rarity" in i);
    expect(gacha.every((i) => i.price === null && i.kind === "cosmetic" && ("currency" in i ? i.currency : "xu") === "xu")).toBe(true);
    expect(gacha.every((i) => "theme" in i && i.theme === "legendes_sombres")).toBe(true);
    const count = (r: string) => gacha.filter((i) => "rarity" in i && i.rarity === r).length;
    expect([count("common"), count("rare"), count("epic"), count("legendary")]).toEqual([4, 4, 3, 1]);
    expect(gacha).toHaveLength(12);
  });

  test("gacha prices, refunds and rates are those of the migration", () => {
    const sql = readFileSync(`${DIR}/20261025000000_gacha.sql`, "utf8");
    expect(sql).toMatch(/when 1 then 40 when 10 then 360/);
    expect(sql).toMatch(/'common' then 8 when 'rare' then 20 when 'epic' then 50 when 'legendary' then 120/);
    expect(sql).toMatch(/v_r1 < 0\.60[\s\S]*v_r1 < 0\.88[\s\S]*v_r1 < 0\.98/);
    expect(sql).toMatch(/v_pity \+ 1 >= 40/);
  });

  test("only the arena items are paid in Kim bài", () => {
    const kimBai = shopRows().filter((r) => r.currency === "kim_bai").map((r) => r.id);
    expect(kimBai).toEqual(["hat_tay_son", "acc_con_vo", "outfit_hoi_vat"]);
  });

  test("badge_reward rows equal the rewards of badges.json", () => {
    const fromJson = badges.badges.flatMap((b) => ("reward" in b && typeof b.reward === "string" ? [{ badge: b.id, item: b.reward }] : []));
    const byBadge = (a: { badge: string }, b: { badge: string }) => a.badge.localeCompare(b.badge);
    expect([...rewardRows()].sort(byBadge)).toEqual([...fromJson].sort(byBadge));
  });

  test("every reward is a reward-only item, and every reward-only item is the reward of exactly one badge", () => {
    const rewards = badges.badges.flatMap((b) => ("reward" in b && typeof b.reward === "string" ? [b.reward] : []));
    const priceOf = new Map(shop.items.map((i) => [i.id, i.price]));
    for (const r of rewards) expect(priceOf.get(r)).toBeNull();
    // gacha items have no price either, but they are won by drawing, not by a badge
    for (const i of shop.items.filter((x) => x.price === null && !("rarity" in x))) expect(rewards.filter((r) => r === i.id)).toHaveLength(1);
    for (const r of rewards) expect(shop.items.find((i) => i.id === r)).not.toHaveProperty("rarity");
  });

  test("the streak freeze cap is 2, as in the migration", () => {
    expect(shop.items.find((i) => i.id === "streak_freeze")).toMatchObject({ maxStock: 2 });
    expect(latestMigrationDefining("apply_event")).toMatch(/s.streak_freezes >= 2/);
  });
});
