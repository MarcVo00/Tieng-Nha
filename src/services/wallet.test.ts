import type { AppEvent, BadgeDef, ShopItem } from "@/domain/types";
import { streakAtDay } from "@/services/streak";
import { COINS, walletAt } from "@/services/wallet";

const shop: ShopItem[] = [
  { id: "energy_refill", kind: "consumable", slot: null, price: 30, currency: "xu" },
  { id: "streak_freeze", kind: "consumable", slot: null, price: 50, maxStock: 2, currency: "xu" },
  { id: "frame_bronze", kind: "cosmetic", slot: "frame", price: null, currency: "xu" },
  { id: "frame_jade", kind: "cosmetic", slot: "frame", price: null, currency: "xu" },
  { id: "fx_ink", kind: "cosmetic", slot: "profile_fx", price: null, currency: "xu" },
  { id: "cheap_frame", kind: "cosmetic", slot: "frame", price: 40, currency: "xu" },
  { id: "arena_hat", kind: "cosmetic", slot: "hat", price: 6, currency: "kim_bai" },
];
const rule = { kind: "lessons_done" as const, gte: 1 };
const badges: BadgeDef[] = [
  { id: "streak_7", title: "t", description: "d", icon: "i", rule, reward: "frame_bronze" },
  { id: "perfect_5", title: "t", description: "d", icon: "i", rule, reward: "fx_ink" },
  { id: "plain", title: "t", description: "d", icon: "i", rule },
];
let n = 0;
const ev = (type: AppEvent["type"], payload: Record<string, unknown> = {}, refId = "x", day = 10, hour = 10): AppEvent => ({
  clientId: `e${n++}`, schemaVersion: 1, type, refId, xp: 0, payload,
  createdAt: `2026-10-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00:00.000Z`,
});
const exam = (score: unknown, hour: number) => ev("exam_finished", { score }, "exam", 10, hour);
const buy = (itemId: string, hour: number, day = 10) => ev("item_purchased", { itemId }, itemId, day, hour);
const equip = (slot: string, itemId: string | null, hour: number) => ev("item_equipped", { slot, itemId }, "eq", 10, hour);
const coinsOf = (events: AppEvent[]) => walletAt(events, shop, badges).coins;

describe("earning", () => {
  test("lesson 10, perfect +5 only for boolean true", () => {
    expect(coinsOf([ev("lesson_completed")])).toBe(COINS.lesson);
    expect(coinsOf([ev("lesson_completed", { perfect: true })])).toBe(15);
    expect(coinsOf([ev("lesson_completed", { perfect: "true" })])).toBe(10);
  });
  test("dialogue 5, review 3, session_started 0", () => {
    expect(coinsOf([ev("dialogue_completed")])).toBe(5);
    expect(coinsOf([ev("review_session_completed")])).toBe(3);
    expect(coinsOf([ev("session_started", { kind: "lesson" })])).toBe(0);
  });
  test("a badge pays only the first time", () => {
    const events = [ev("badge_unlocked", {}, "b1", 10, 1), ev("badge_unlocked", {}, "b1", 10, 2), ev("badge_unlocked", {}, "b2", 10, 3)];
    expect(coinsOf(events)).toBe(20);
  });
  test("first exam win 50, later wins 20, fails 0", () => {
    expect(coinsOf([exam(69, 1)])).toBe(0);
    expect(coinsOf([exam(70, 1)])).toBe(50);
    expect(coinsOf([exam(80, 1), exam(90, 2)])).toBe(70);
    expect(coinsOf([exam(50, 1), exam(75, 2), exam(40, 3), exam(99, 4)])).toBe(70);
  });
  test("scores are normalised like the server", () => {
    expect(coinsOf([exam(69.6, 1)])).toBe(50); // rounds to 70
    expect(coinsOf([exam(250, 1)])).toBe(50);
    expect(coinsOf([exam("abc", 1), exam(undefined, 2)])).toBe(0);
    expect(coinsOf([exam(-5, 1)])).toBe(0);
  });
  test("events are replayed in time order", () => {
    expect(coinsOf([exam(90, 5), exam(80, 3)])).toBe(70);
  });
  test("purchases and equips earn nothing", () => {
    expect(coinsOf([buy("cheap_frame", 1), equip("frame", "cheap_frame", 2)])).toBe(0);
  });
});

describe("purchases", () => {
  // 50 + 8 * 20 = 210 coins
  const funds = (): AppEvent[] => Array.from({ length: 9 }, (_, i) => exam(90, i));
  test("accepted purchase debits the catalogue price", () => {
    const w = walletAt([...funds(), buy("cheap_frame", 9)], shop, badges);
    expect(w.coins).toBe(170);
    expect(w.inventory).toEqual(["cheap_frame"]);
  });
  test("refused: unknown item", () => expect(coinsOf([...funds(), buy("nope", 9)])).toBe(210));
  test("refused: balance too low", () => {
    const w = walletAt([ev("lesson_completed"), buy("cheap_frame", 11)], shop, badges);
    expect(w.coins).toBe(10);
    expect(w.inventory).toEqual([]);
  });
  test("refused: cosmetic already owned", () => {
    const w = walletAt([...funds(), buy("cheap_frame", 9), buy("cheap_frame", 10)], shop, badges);
    expect(w.coins).toBe(170);
    expect(w.inventory).toEqual(["cheap_frame"]);
  });
  test("a Kim bài item is not bought with coins", () => {
    const w = walletAt([...funds(), buy("arena_hat", 9)], shop, badges);
    expect(w.coins).toBe(210);
    expect(w.inventory).toEqual([]);
  });
  test("purchase of a reward-priced item is refused", () => {
    const w = walletAt([...Array.from({ length: 10 }, (_, i) => exam(90, i)), buy("frame_bronze", 11)], shop, badges);
    expect(w.coins).toBe(230);
    expect(w.inventory).toEqual([]);
  });
  test("energy refill is repeatable and recorded", () => {
    const w = walletAt([...funds(), buy("energy_refill", 9), buy("energy_refill", 10)], shop, badges);
    expect(w.coins).toBe(150);
    expect(w.refills).toHaveLength(2);
  });
  test("streak freeze capped at 2 in stock", () => {
    const w = walletAt([...funds(), buy("streak_freeze", 9), buy("streak_freeze", 10), buy("streak_freeze", 11)], shop, badges);
    expect(w.freezes).toBe(2);
    expect(w.coins).toBe(110);
  });
  test("the freeze cap comes from the catalogue", () => {
    const tight = shop.map((i) => (i.id === "streak_freeze" ? { ...i, maxStock: 1 } : i));
    const w = walletAt([...funds(), buy("streak_freeze", 9), buy("streak_freeze", 10)], tight, badges);
    expect(w.freezes).toBe(1);
  });
  test("freezes consumed by the streak free room for a new purchase", () => {
    const events = [
      ...funds(),
      buy("streak_freeze", 9), buy("streak_freeze", 10),
      ev("lesson_completed", {}, "a", 11, 10),
      ev("lesson_completed", {}, "b", 14, 10), // 2 missed days consume 2 freezes
      buy("streak_freeze", 11, 14),
    ];
    const w = walletAt(events, shop, badges);
    expect(w.freezes).toBe(1);
  });
  test("a gap larger than the stock consumes nothing", () => {
    const events = [...funds(), buy("streak_freeze", 9), ev("lesson_completed", {}, "a", 11), ev("lesson_completed", {}, "b", 15)];
    expect(walletAt(events, shop, badges).freezes).toBe(1);
  });
});

describe("equipment", () => {
  const owned = (): AppEvent[] => [ev("badge_unlocked", {}, "streak_7", 10, 3)];
  test("owned item of the right slot is equipped", () =>
    expect(walletAt([...owned(), equip("frame", "frame_bronze", 4)], shop, badges).equipped).toEqual({ frame: "frame_bronze" }));
  test("unowned item is ignored", () =>
    expect(walletAt([...owned(), equip("frame", "frame_jade", 4)], shop, badges).equipped).toEqual({}));
  test("wrong slot is ignored", () =>
    expect(walletAt([...owned(), equip("hat", "frame_bronze", 4)], shop, badges).equipped).toEqual({}));
  test("null removes", () =>
    expect(walletAt([...owned(), equip("frame", "frame_bronze", 4), equip("frame", null, 5)], shop, badges).equipped).toEqual({}));
  test("a consumable cannot be equipped", () =>
    expect(walletAt([...owned(), equip("frame", "energy_refill", 4)], shop, badges).equipped).toEqual({}));
});

describe("badge rewards", () => {
  const perfect = (id: string, hour: number) => ev("lesson_completed", { perfect: true }, id, 10, hour);
  test("first badge_unlocked adds its reward once", () => {
    const w = walletAt([ev("badge_unlocked", {}, "streak_7", 10, 1), ev("badge_unlocked", {}, "streak_7", 10, 2)], shop, badges);
    expect(w.coins).toBe(10);
    expect(w.inventory).toEqual(["frame_bronze"]);
  });
  test("a badge without reward adds nothing to the inventory", () =>
    expect(walletAt([ev("badge_unlocked", {}, "plain", 10, 1)], shop, badges).inventory).toEqual([]));
  test("case A: purchase and equip before the badge are refused, the badge then pays and grants", () => {
    const w = walletAt([perfect("a", 0), perfect("b", 1), perfect("c", 2), buy("frame_bronze", 3), equip("frame", "frame_bronze", 4), ev("badge_unlocked", {}, "streak_7", 10, 5)], shop, badges);
    expect(w.coins).toBe(55);
    expect(w.inventory).toEqual(["frame_bronze"]);
    expect(w.equipped).toEqual({});
  });
  test("case B: badge, then purchase refused, then equip works", () => {
    const w = walletAt([perfect("a", 0), ev("badge_unlocked", {}, "streak_7", 10, 1), buy("frame_bronze", 2), equip("frame", "frame_bronze", 3)], shop, badges);
    expect(w.coins).toBe(25);
    expect(w.inventory).toEqual(["frame_bronze"]);
    expect(w.equipped).toEqual({ frame: "frame_bronze" });
  });
  test("case C: purchase and equip without the badge change nothing", () => {
    const w = walletAt([exam(90, 0), buy("frame_bronze", 1), equip("frame", "frame_bronze", 2)], shop, badges);
    expect(w.coins).toBe(50);
    expect(w.inventory).toEqual([]);
    expect(w.equipped).toEqual({});
  });
  test("equip profile_fx only for an owned fx item", () => {
    const base = [ev("badge_unlocked", {}, "perfect_5", 10, 1), ev("badge_unlocked", {}, "streak_7", 10, 2)];
    expect(walletAt([...base, equip("profile_fx", "fx_ink", 3)], shop, badges).equipped).toEqual({ profile_fx: "fx_ink" });
    expect(walletAt([...base, equip("profile_fx", "frame_bronze", 3)], shop, badges).equipped).toEqual({});
    expect(walletAt([...base, equip("profile_fx", "fx_ink", 3), equip("profile_fx", null, 4)], shop, badges).equipped).toEqual({});
    expect(walletAt([ev("badge_unlocked", {}, "streak_7", 10, 2), equip("profile_fx", "fx_ink", 3)], shop, badges).equipped).toEqual({});
  });
});

describe("streak replay", () => {
  const funds = (): AppEvent[] => Array.from({ length: 3 }, (_, i) => ev("exam_finished", { score: 90 }, "exam", 1, i)); // 90 coins on day 1
  const lesson = (day: number, hour: number, id: string) => ev("lesson_completed", {}, id, day, hour);
  test("counts consecutive days and restarts after an uncovered gap", () => {
    const w = walletAt([lesson(11, 10, "a"), lesson(12, 10, "b"), lesson(15, 10, "c")], shop, badges);
    expect(w.streak).toBe(1);
    expect(w.lastActiveDay).toBe("2026-10-15");
  });
  test("a freeze bought after the gap-ending activity does not rescue it (server event order)", () => {
    const events = [...funds(), lesson(1, 9, "a"), lesson(3, 9, "b"), buy("streak_freeze", 10, 3)];
    const w = walletAt(events, shop, badges);
    expect(w.streak).toBe(1);
    expect(w.freezes).toBe(1);
    // one more missed day: the freeze now bridges it
    const w2 = walletAt([...events, lesson(5, 9, "c")], shop, badges);
    expect(w2.streak).toBe(2);
    expect(w2.freezes).toBe(0);
  });
  test("a freeze bought before the activity bridges the gap", () => {
    const w = walletAt([...funds(), lesson(11, 10, "a"), buy("streak_freeze", 3, 11), lesson(13, 10, "b")], shop, badges);
    expect(w.streak).toBe(2);
    expect(w.freezes).toBe(0);
  });
  test("the current value at today follows the freezes left", () => {
    const w = walletAt([...funds(), lesson(11, 10, "a"), buy("streak_freeze", 3, 11)], shop, badges);
    expect(streakAtDay(w.streak, w.lastActiveDay, w.freezes, "2026-10-13")).toBe(1);
    expect(streakAtDay(w.streak, w.lastActiveDay, w.freezes, "2026-10-14")).toBe(0);
  });
});
