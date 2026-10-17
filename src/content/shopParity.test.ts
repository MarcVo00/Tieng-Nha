import { readFileSync } from "node:fs";
import shop from "@/content/shop.json";

const sql = readFileSync("supabase/migrations/20261015000000_coins_shop.sql", "utf8");

// Rows look like: ('frame_bronze', 40, 'cosmetic', 'frame') or ('energy_refill', 30, 'consumable', null::text)
function sqlRows() {
  const rows = [...sql.matchAll(/\(\s*'([a-z_]+)'\s*,\s*(\d+)\s*,\s*'(consumable|cosmetic)'\s*,\s*(?:'([a-z_]+)'|null(?:::text)?)\s*\)/g)];
  return rows.map((m) => ({ id: m[1], price: Number(m[2]), kind: m[3], slot: m[4] ?? null }));
}

describe("catalogue parity with the SQL migration", () => {
  test("shop_item rows equal shop.json items", () => {
    const fromJson = shop.items.map((i) => ({ id: i.id, price: i.price, kind: i.kind, slot: i.slot }));
    const rows = sqlRows();
    expect(rows).toHaveLength(fromJson.length);
    expect(rows).toEqual(fromJson);
  });

  test("the streak freeze cap is 2, as in the migration", () => {
    expect(shop.items.find((i) => i.id === "streak_freeze")).toMatchObject({ maxStock: 2 });
    expect(sql).toMatch(/s.streak_freezes >= 2/);
  });
});
