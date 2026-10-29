import type { AppEvent, BadgeDef, ItemSlot, ShopItem, Wallet } from "@/domain/types";
import { gachaRefund, isGachaItem } from "@/services/gacha";
import { STREAK_EVENT_TYPES } from "@/services/progress";
import { daysBetween, parisDay } from "@/services/time";

export const COINS = { lesson: 10, perfectBonus: 5, dialogue: 5, review: 3, badge: 10, firstBossWin: 50, bossWin: 20, bossPass: 70 } as const;

const DEFAULT_MAX_FREEZES = 2;

/** xu of day 1..7 of the daily-bonus run. Mirrors `daily_bonus_amount`. */
export const DAILY_BONUS = [10, 10, 15, 15, 20, 20, 50] as const;

export function dailyBonusAmount(day: number): number {
  return DAILY_BONUS[day - 1] ?? 0;
}

/** Place in the run (1..7) of a bonus claimed on `day`, given the last one. Same rule as the server. */
function bonusRunDay(w: Pick<Wallet, "bonusDay" | "bonusStreak">, day: string): number {
  return w.bonusDay !== null && daysBetween(w.bonusDay, day) === 1 ? (w.bonusStreak % DAILY_BONUS.length) + 1 : 1;
}

/** The bonus still to open on Paris day `today`, or null once it is claimed. */
export function nextDailyBonus(w: Wallet, today: string): { day: number; coins: number } | null {
  if (w.bonusDay !== null && w.bonusDay >= today) return null;
  const day = bonusRunDay(w, today);
  return { day, coins: dailyBonusAmount(day) };
}

/** Same normalisation as the server: rounded, clamped to 0..100, anything non-numeric counts as 0. */
export function normalisedScore(v: unknown): number {
  const n = typeof v === "number" ? v : typeof v === "string" && /^[0-9]+(\.[0-9]+)?$/.test(v) ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : 0;
}

/** Coins earned by one event, given the best exam score before it (null = none). Mirrors `coins_for_event`. */
export function coinsForEvent(e: AppEvent, bestBefore: number | null): number {
  switch (e.type) {
    case "lesson_completed":
      return COINS.lesson + (e.payload["perfect"] === true ? COINS.perfectBonus : 0);
    case "dialogue_completed":
      return COINS.dialogue;
    case "review_session_completed":
      return COINS.review;
    case "badge_unlocked":
      return COINS.badge;
    case "exam_finished":
      if (normalisedScore(e.payload["score"]) < COINS.bossPass) return 0;
      return (bestBefore ?? 0) < COINS.bossPass ? COINS.firstBossWin : COINS.bossWin;
    default:
      return 0;
  }
}

/** xu paid by the first unlock of a badge; 0 for an unknown id. Mirrors `badge_coins`. */
export function badgeCoins(badges: readonly BadgeDef[], badgeId: string): number {
  return badges.find((b) => b.id === badgeId)?.coins ?? 0;
}

/** The item a badge grants when first unlocked, or null (no such badge, or no reward). */
export function rewardItem(badges: readonly BadgeDef[], badgeId: string): string | null {
  return badges.find((b) => b.id === badgeId)?.reward ?? null;
}

export type PricedItem = ShopItem & { price: number };

/** The catalogue item a purchase would buy, or null when the server rules refuse it (reward-only items have no price). */
export function purchasable(w: Wallet, shop: readonly ShopItem[], itemId: unknown): PricedItem | null {
  const item = typeof itemId === "string" ? shop.find((i) => i.id === itemId) : undefined;
  if (!item || item.price === null) return null;
  if ((item.currency === "kim_bai" ? w.kimBai : w.coins) < item.price) return null;
  const priced: PricedItem = { ...item, price: item.price };
  if (item.kind === "cosmetic" && w.inventory.includes(item.id)) return null;
  if (item.id === "streak_freeze" && w.freezes >= (item.maxStock ?? DEFAULT_MAX_FREEZES)) return null;
  return priced;
}

/** True when equipping `itemId` (null = remove) in `slot` is accepted. */
export function equippable(w: Wallet, shop: readonly ShopItem[], slot: unknown, itemId: unknown): boolean {
  if (typeof slot !== "string") return false;
  if (itemId === null || itemId === undefined) return true;
  return typeof itemId === "string" && w.inventory.includes(itemId) && shop.find((i) => i.id === itemId)?.slot === slot;
}

const isCount = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0;

/** A well-formed `gacha_pulled` payload as { cost, refunds, newItems } (inventory handled by the caller), or null. */
function gachaEffect(payload: Record<string, unknown>, shop: readonly ShopItem[]): { cost: number; refunds: number; itemIds: string[] } | null {
  const { cost, items } = payload;
  if (!isCount(cost) || !Array.isArray(items)) return null;
  let refunds = 0;
  const itemIds: string[] = [];
  for (const it of items as unknown[]) {
    if (typeof it !== "object" || it === null) return null;
    const { itemId, duplicate, refund } = it as Record<string, unknown>;
    if (typeof itemId !== "string" || typeof duplicate !== "boolean" || !isCount(refund)) return null;
    // Only catalogue gacha items count, and a refund never exceeds what the item's catalogue rarity refunds.
    const known = shop.find((s) => s.id === itemId);
    if (!known || !isGachaItem(known) || known.rarity === undefined) return null;
    refunds += Math.min(refund, gachaRefund(known.rarity));
    if (!duplicate) itemIds.push(itemId);
  }
  return { cost, refunds, itemIds };
}

/** Replays the journal in time order with the server rules (earning, purchase acceptance, equipment). */
export function walletAt(events: readonly AppEvent[], shop: readonly ShopItem[], badgeDefs: readonly BadgeDef[]): Wallet {
  const sorted = [...events].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const w: Wallet = { coins: 0, kimBai: 0, inventory: [], equipped: {}, freezes: 0, refills: [], streak: 0, lastActiveDay: null, bonusDay: null, bonusStreak: 0 };
  const unlocked = new Set<string>();
  const settledDuels = new Set<string>();
  const pulls = new Set<string>();
  let best: number | null = null;

  for (const e of sorted) {
    if (e.type === "item_purchased") {
      const item = purchasable(w, shop, e.payload["itemId"]);
      if (!item) continue;
      if (item.currency === "kim_bai") w.kimBai -= item.price;
      else w.coins -= item.price;
      if (item.id === "streak_freeze") w.freezes += 1;
      else if (item.kind === "cosmetic") w.inventory.push(item.id);
      else if (item.id === "energy_refill") w.refills.push(e.createdAt);
      continue;
    }
    if (e.type === "item_equipped") {
      const slot = e.payload["slot"];
      const id = e.payload["itemId"];
      if (!equippable(w, shop, slot, id)) continue;
      if (typeof id === "string") w.equipped[slot as ItemSlot] = id;
      else w.equipped = Object.fromEntries(Object.entries(w.equipped).filter(([k]) => k !== slot)) as Wallet["equipped"];
      continue;
    }
    if (e.type === "duel_settled") {
      // Same as the server: each duel credits once; only non-negative integers count.
      const kb = e.payload["kimBai"];
      if (!settledDuels.has(e.refId) && typeof kb === "number" && Number.isInteger(kb) && kb >= 0) w.kimBai += kb;
      settledDuels.add(e.refId);
      continue;
    }
    if (e.type === "gacha_pulled") {
      // The server already debited and credited (ADR gacha): the journal only mirrors it, once per pull, malformed payloads ignored.
      const fx = pulls.has(e.refId) ? null : gachaEffect(e.payload, shop);
      if (!fx) continue;
      pulls.add(e.refId);
      w.coins += fx.refunds - fx.cost;
      for (const id of fx.itemIds) if (!w.inventory.includes(id)) w.inventory.push(id);
      continue;
    }
    if (e.type === "daily_bonus_claimed") {
      // Same as the server (minus its "today or yesterday" check): refId is the event's Paris day, later than the last bonus.
      const day = parisDay(e.createdAt);
      if (e.refId !== day || (w.bonusDay !== null && day <= w.bonusDay)) continue;
      w.bonusStreak = bonusRunDay(w, day);
      w.bonusDay = day;
      w.coins += dailyBonusAmount(w.bonusStreak);
      continue;
    }
    if (e.type === "demo_grant") {
      // Demo mode only (local journal, never synced): non-negative integers only.
      const { coins, kimBai } = e.payload;
      if (typeof coins === "number" && Number.isInteger(coins) && coins >= 0) w.coins += coins;
      if (typeof kimBai === "number" && Number.isInteger(kimBai) && kimBai >= 0) w.kimBai += kimBai;
      continue;
    }
    if (e.type === "badge_unlocked") {
      if (!unlocked.has(e.refId)) {
        w.coins += badgeCoins(badgeDefs, e.refId);
        const reward = rewardItem(badgeDefs, e.refId);
        if (reward !== null && !w.inventory.includes(reward)) w.inventory.push(reward);
      }
      unlocked.add(e.refId);
    } else {
      w.coins += coinsForEvent(e, best);
    }
    if (e.type === "exam_finished") best = Math.max(best ?? 0, normalisedScore(e.payload["score"]));
    if (STREAK_EVENT_TYPES.includes(e.type)) {
      // Same as the server: consecutive day +1; g missed days <= stock consume g and +1; else restart at 1.
      const day = parisDay(e.createdAt);
      if (w.lastActiveDay === null || day > w.lastActiveDay) {
        const missed = w.lastActiveDay === null ? 0 : daysBetween(w.lastActiveDay, day) - 1;
        if (w.lastActiveDay !== null && missed === 0) w.streak += 1;
        else if (w.lastActiveDay !== null && missed <= w.freezes) {
          w.freezes -= missed;
          w.streak += 1;
        } else w.streak = 1;
        w.lastActiveDay = day;
      }
    }
  }
  return w;
}
