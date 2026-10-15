import type { AppEvent, ItemSlot, ShopItem, Wallet } from "@/domain/types";
import { daysBetween, parisDay } from "@/services/time";

export const COINS = { lesson: 10, perfectBonus: 5, dialogue: 5, review: 3, badge: 10, firstBossWin: 50, bossWin: 20, bossPass: 70 } as const;

const STREAK_TYPES = ["lesson_completed", "dialogue_completed", "review_session_completed"];
const MAX_FREEZES = 2;

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

/** Replays the journal in time order with the server rules (earning, purchase acceptance, equipment). */
export function walletAt(events: readonly AppEvent[], shop: readonly ShopItem[]): Wallet {
  const sorted = [...events].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const w: Wallet = { coins: 0, inventory: [], equipped: {}, freezes: 0, refills: [], freezeDays: [] };
  const badges = new Set<string>();
  let best: number | null = null;
  let lastActive: string | null = null;

  for (const e of sorted) {
    if (e.type === "item_purchased") {
      const id = e.payload["itemId"];
      const item = typeof id === "string" ? shop.find((i) => i.id === id) : undefined;
      if (!item || w.coins < item.price) continue;
      if (item.kind === "cosmetic" && w.inventory.includes(item.id)) continue;
      if (item.id === "streak_freeze" && w.freezes >= MAX_FREEZES) continue;
      w.coins -= item.price;
      if (item.id === "streak_freeze") {
        w.freezes += 1;
        w.freezeDays.push(parisDay(e.createdAt));
      } else if (item.kind === "cosmetic") w.inventory.push(item.id);
      else if (item.id === "energy_refill") w.refills.push(e.createdAt);
      continue;
    }
    if (e.type === "item_equipped") {
      const slot = e.payload["slot"];
      const id = e.payload["itemId"];
      if (typeof slot !== "string") continue;
      if (id === null || id === undefined) w.equipped = Object.fromEntries(Object.entries(w.equipped).filter(([k]) => k !== slot)) as Wallet["equipped"];
      else if (typeof id === "string" && w.inventory.includes(id) && shop.find((i) => i.id === id)?.slot === slot) {
        w.equipped[slot as ItemSlot] = id;
      }
      continue;
    }
    if (e.type === "badge_unlocked") {
      if (!badges.has(e.refId)) w.coins += coinsForEvent(e, best);
      badges.add(e.refId);
    } else {
      w.coins += coinsForEvent(e, best);
    }
    if (e.type === "exam_finished") best = Math.max(best ?? 0, normalisedScore(e.payload["score"]));
    if (STREAK_TYPES.includes(e.type)) {
      // A new active day after g missed days consumes g freezes when the stock allows (else the streak restarts).
      const day = parisDay(e.createdAt);
      if (lastActive === null || day > lastActive) {
        if (lastActive !== null) {
          const missed = daysBetween(lastActive, day) - 1;
          if (missed >= 1 && missed <= w.freezes) w.freezes -= missed;
        }
        lastActive = day;
      }
    }
  }
  return w;
}
