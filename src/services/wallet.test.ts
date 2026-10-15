import type { AppEvent, ShopItem } from "@/domain/types";
import { streakAtDay } from "@/services/streak";
import { COINS, walletAt } from "@/services/wallet";

const shop: ShopItem[] = [
  { id: "energy_refill", kind: "consumable", slot: null, price: 30 },
  { id: "streak_freeze", kind: "consumable", slot: null, price: 50, maxStock: 2 },
  { id: "frame_bronze", kind: "cosmetic", slot: "frame", price: 40 },
  { id: "frame_jade", kind: "cosmetic", slot: "frame", price: 80 },
];
let n = 0;
const ev = (type: AppEvent["type"], payload: Record<string, unknown> = {}, refId = "x", day = 10, hour = 10): AppEvent => ({
  clientId: `e${n++}`, schemaVersion: 1, type, refId, xp: 0, payload,
  createdAt: `2026-10-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00:00.000Z`,
});
const exam = (score: unknown, hour: number) => ev("exam_finished", { score }, "exam", 10, hour);
const buy = (itemId: string, hour: number, day = 10) => ev("item_purchased", { itemId }, itemId, day, hour);
const equip = (slot: string, itemId: string | null, hour: number) => ev("item_equipped", { slot, itemId }, "eq", 10, hour);
const coinsOf = (events: AppEvent[]) => walletAt(events, shop).coins;

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
    expect(coinsOf([buy("frame_bronze", 1), equip("frame", "frame_bronze", 2)])).toBe(0);
  });
});

describe("purchases", () => {
  // 50 + 8 * 20 = 210 coins
  const funds = (): AppEvent[] => Array.from({ length: 9 }, (_, i) => exam(90, i));
  test("accepted purchase debits the catalogue price", () => {
    const w = walletAt([...funds(), buy("frame_bronze", 9)], shop);
    expect(w.coins).toBe(170);
    expect(w.inventory).toEqual(["frame_bronze"]);
  });
  test("refused: unknown item", () => expect(coinsOf([...funds(), buy("nope", 9)])).toBe(210));
  test("refused: balance too low", () => {
    const w = walletAt([ev("lesson_completed"), buy("frame_bronze", 11)], shop);
    expect(w.coins).toBe(10);
    expect(w.inventory).toEqual([]);
  });
  test("refused: cosmetic already owned", () => {
    const w = walletAt([...funds(), buy("frame_bronze", 9), buy("frame_bronze", 10)], shop);
    expect(w.coins).toBe(170);
    expect(w.inventory).toEqual(["frame_bronze"]);
  });
  test("energy refill is repeatable and recorded", () => {
    const w = walletAt([...funds(), buy("energy_refill", 9), buy("energy_refill", 10)], shop);
    expect(w.coins).toBe(150);
    expect(w.refills).toHaveLength(2);
  });
  test("streak freeze capped at 2 in stock", () => {
    const w = walletAt([...funds(), buy("streak_freeze", 9), buy("streak_freeze", 10), buy("streak_freeze", 11)], shop);
    expect(w.freezes).toBe(2);
    expect(w.coins).toBe(110);
  });
  test("freezes consumed by the streak free room for a new purchase", () => {
    const events = [
      ...funds(),
      buy("streak_freeze", 9), buy("streak_freeze", 10),
      ev("lesson_completed", {}, "a", 11, 10),
      ev("lesson_completed", {}, "b", 14, 10), // 2 missed days consume 2 freezes
      buy("streak_freeze", 11, 14),
    ];
    const w = walletAt(events, shop);
    expect(w.freezes).toBe(1);
  });
  test("a gap larger than the stock consumes nothing", () => {
    const events = [...funds(), buy("streak_freeze", 9), ev("lesson_completed", {}, "a", 11), ev("lesson_completed", {}, "b", 15)];
    expect(walletAt(events, shop).freezes).toBe(1);
  });
});

describe("equipment", () => {
  const owned = (): AppEvent[] => [exam(90, 0), exam(90, 1), exam(90, 2), buy("frame_bronze", 3)];
  test("owned item of the right slot is equipped", () =>
    expect(walletAt([...owned(), equip("frame", "frame_bronze", 4)], shop).equipped).toEqual({ frame: "frame_bronze" }));
  test("unowned item is ignored", () =>
    expect(walletAt([...owned(), equip("frame", "frame_jade", 4)], shop).equipped).toEqual({}));
  test("wrong slot is ignored", () =>
    expect(walletAt([...owned(), equip("hat", "frame_bronze", 4)], shop).equipped).toEqual({}));
  test("null removes", () =>
    expect(walletAt([...owned(), equip("frame", "frame_bronze", 4), equip("frame", null, 5)], shop).equipped).toEqual({}));
  test("a consumable cannot be equipped", () =>
    expect(walletAt([...owned(), equip("frame", "energy_refill", 4)], shop).equipped).toEqual({}));
});

describe("streak replay", () => {
  const funds = (): AppEvent[] => Array.from({ length: 3 }, (_, i) => ev("exam_finished", { score: 90 }, "exam", 1, i)); // 90 coins on day 1
  const lesson = (day: number, hour: number, id: string) => ev("lesson_completed", {}, id, day, hour);
  test("counts consecutive days and restarts after an uncovered gap", () => {
    const w = walletAt([lesson(11, 10, "a"), lesson(12, 10, "b"), lesson(15, 10, "c")], shop);
    expect(w.streak).toBe(1);
    expect(w.lastActiveDay).toBe("2026-10-15");
  });
  test("a freeze bought after the gap-ending activity does not rescue it (server event order)", () => {
    const events = [...funds(), lesson(1, 9, "a"), lesson(3, 9, "b"), buy("streak_freeze", 10, 3)];
    const w = walletAt(events, shop);
    expect(w.streak).toBe(1);
    expect(w.freezes).toBe(1);
    // one more missed day: the freeze now bridges it
    const w2 = walletAt([...events, lesson(5, 9, "c")], shop);
    expect(w2.streak).toBe(2);
    expect(w2.freezes).toBe(0);
  });
  test("a freeze bought before the activity bridges the gap", () => {
    const w = walletAt([...funds(), lesson(11, 10, "a"), buy("streak_freeze", 3, 11), lesson(13, 10, "b")], shop);
    expect(w.streak).toBe(2);
    expect(w.freezes).toBe(0);
  });
  test("the current value at today follows the freezes left", () => {
    const w = walletAt([...funds(), lesson(11, 10, "a"), buy("streak_freeze", 3, 11)], shop);
    expect(streakAtDay(w.streak, w.lastActiveDay, w.freezes, "2026-10-13")).toBe(1);
    expect(streakAtDay(w.streak, w.lastActiveDay, w.freezes, "2026-10-14")).toBe(0);
  });
});
