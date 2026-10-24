import type { Rarity, ShopItem } from "@/domain/types";

/** Gacha rules. Mirrors `gacha_draw` / `gacha_cost` / `gacha_refund` in `supabase/migrations/20261025000000_gacha.sql`. */
export const GACHA = {
  costs: { 1: 40, 10: 360 },
  pityAt: 40,
  /** Cumulative upper bounds (exclusive) of the rarity roll: common, rare, epic; anything above is legendary. */
  thresholds: [0.6, 0.88, 0.98],
  refunds: { common: 8, rare: 20, epic: 50, legendary: 120 },
} as const satisfies { costs: Record<number, number>; pityAt: number; thresholds: readonly number[]; refunds: Record<Rarity, number> };

export const RARITY_ORDER: readonly Rarity[] = ["common", "rare", "epic", "legendary"];

export type GachaItemResult = { itemId: string; rarity: Rarity; duplicate: boolean; refund: number };
export type GachaDraw = { items: GachaItemResult[]; pity: number };

/** Price in xu of a pull of `count` items, or null when the count is not offered. */
export function gachaCost(count: number): number | null {
  return count === 1 ? GACHA.costs[1] : count === 10 ? GACHA.costs[10] : null;
}

export function gachaRefund(rarity: Rarity): number {
  return GACHA.refunds[rarity];
}

/** True for an item that only the gacha gives: an xu cosmetic of a theme, with a rarity and no price. */
export function isGachaItem(i: ShopItem): boolean {
  return i.rarity !== undefined && i.kind === "cosmetic" && i.currency === "xu" && i.price === null && i.theme !== undefined;
}

/** The gacha items of one theme. */
export function themeItems(shop: readonly ShopItem[], theme: string): ShopItem[] {
  return shop.filter((i) => isGachaItem(i) && i.theme === theme);
}

const byIdCodeUnits = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0); // C collation, never localeCompare

/**
 * The draw. Two rolls in [0,1) per item (`rolls[2i]` picks the rarity, `rolls[2i+1]` the item). `pity` is the counter
 * before the pull. Throws on too few / non-finite rolls or a theme without items (same cases the SQL raises).
 */
export function gachaDraw(
  state: { pity: number | null | undefined },
  items: readonly ShopItem[],
  inventory: readonly string[],
  count: number,
  rolls: readonly number[],
): GachaDraw {
  if (!Number.isInteger(count) || count < 1 || rolls.length < 2 * count) throw new Error("gachaDraw: need two rolls per item");
  const pools = RARITY_ORDER.map((r) => items.filter((i) => i.rarity === r && isGachaItem(i)).map((i) => i.id).sort(byIdCodeUnits));
  const rarityOf = new Map(items.map((i) => [i.id, i.rarity as Rarity]));
  const seen = new Set(inventory);
  const out: GachaItemResult[] = [];
  let pity = Math.max(state.pity ?? 0, 0);
  let allCommon = true;

  for (let i = 0; i < count; i++) {
    const r1 = rolls[2 * i];
    const r2 = rolls[2 * i + 1];
    if (r1 === undefined || r2 === undefined || !Number.isFinite(r1) || !Number.isFinite(r2)) throw new Error("gachaDraw: invalid roll");

    let rank: number;
    if (pity + 1 >= GACHA.pityAt) rank = 3;
    else if (r1 < GACHA.thresholds[0]) rank = 0;
    else if (r1 < GACHA.thresholds[1]) rank = 1;
    else if (r1 < GACHA.thresholds[2]) rank = 2;
    else rank = 3;
    if (count === 10 && i === 9 && allCommon) rank = Math.max(rank, 1);

    // wanted rarity, else the next lower one that has items, else the nearest higher one
    let pool: string[] = [];
    for (let k = rank; k >= 0 && pool.length === 0; k--) pool = pools[k] ?? [];
    for (let k = rank + 1; k <= 3 && pool.length === 0; k++) pool = pools[k] ?? [];
    if (pool.length === 0) throw new Error("gachaDraw: empty theme");

    const id = pool[Math.min(Math.max(Math.floor(r2 * pool.length), 0), pool.length - 1)] as string;
    const rarity = rarityOf.get(id) as Rarity;
    const duplicate = seen.has(id);
    seen.add(id);
    out.push({ itemId: id, rarity, duplicate, refund: duplicate ? gachaRefund(rarity) : 0 });
    allCommon = allCommon && rarity === "common";
    pity = rarity === "legendary" ? 0 : pity + 1;
  }
  return { items: out, pity };
}
