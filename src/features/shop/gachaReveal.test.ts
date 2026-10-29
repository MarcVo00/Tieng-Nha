import { beforeEach, describe, expect, test, vi } from "vitest";
import type { GachaPullItem } from "@/domain/types";
import { duration } from "@/ui/motion";
import {
  autoAdvance,
  BUDGET,
  CARD_RATIO,
  dealSchedule,
  initialReveal,
  omenDuration,
  peakConcurrency,
  REVEAL,
  recapOrder,
  revealAllOrder,
  revealReducer,
  scrollBeats,
  topRarity,
  type RevealAction,
  type RevealState,
} from "@/features/shop/gachaReveal";

// The registry ships empty (Task 5 fills it): a test double decides which pieces have a signature.
const sig = vi.hoisted(() => ({ ids: new Set<string>() }));
vi.mock("@/features/shop/signatures", () => ({ SIGNATURES: {}, hasSignature: (id: string) => sig.ids.has(id) }));

const item = (itemId: string, rarity: GachaPullItem["rarity"], duplicate = false): GachaPullItem => ({ itemId, rarity, duplicate, refund: duplicate ? 8 : 0 });
const run = (s: RevealState, ...actions: RevealAction[]) => actions.reduce(revealReducer, s);
const DEALT: RevealAction[] = [{ type: "press" }, { type: "release" }, { type: "shakeEnd" }, { type: "omenEnd" }];

beforeEach(() => sig.ids.clear());

describe("the best piece of the pull", () => {
  test("nine commons and a rare: the omen is rare", () => {
    expect(topRarity([...Array.from({ length: 9 }, (_, i) => item(`c${i}`, "common")), item("r", "rare")])).toBe("rare");
    expect(topRarity([item("a", "epic"), item("b", "legendary"), item("c", "common")])).toBe("legendary");
    expect(topRarity([item("a", "common")])).toBe("common");
  });

  test("the omen lasts longer for a rarer best piece, and a pull of commons stays brief", () => {
    const d = (["common", "rare", "epic", "legendary"] as const).map(omenDuration);
    for (let i = 1; i < d.length; i++) expect(d[i]).toBeGreaterThan(d[i - 1] ?? Infinity);
    expect(omenDuration("common")).toBeLessThanOrEqual(duration.slow * 2);
    expect(omenDuration("legendary")).toBeLessThan(3);
  });

  test("every beat is composed from the motion tokens", () => {
    expect(REVEAL.shake).toBe(duration.slow * 2);
    expect(REVEAL.rise).toBe(duration.slow);
    expect(REVEAL.flip).toBe(duration.fast * 2);
    expect(omenDuration("common")).toBeCloseTo(REVEAL.rise + REVEAL.settle);
    expect(omenDuration("legendary")).toBeCloseTo(REVEAL.rise + REVEAL.pause + REVEAL.flood + duration.celebrate);
  });

  test("the shake is bounded: no infinite loop", () => {
    expect(REVEAL.maxShakes).toBeGreaterThan(1);
    expect(REVEAL.maxShakes * REVEAL.shake).toBeLessThan(3);
  });

  test("the ten cards are dealt staggered, within the budget of 8 animated elements", () => {
    const deal = dealSchedule(10);
    expect(deal).toHaveLength(10);
    expect(peakConcurrency(deal)).toBeLessThanOrEqual(BUDGET.animated);
    expect(peakConcurrency([{ delay: 0, length: 1 }, { delay: 0.5, length: 1 }, { delay: 1, length: 1 }])).toBe(2);
  });
});

describe("card size", () => {
  test("a card of the x10 grid is a big target: well over 44 px, about 120 px tall on a 360 px phone", () => {
    // Column width: screen − scene gutter (2 × 16) − panel padding (2 × 8) − body padding (2 × 8) − grid gap (12), halved.
    const height = (screen: number) => (screen - 32 - 16 - 16 - 12) / 2 / CARD_RATIO;
    expect(height(320)).toBeGreaterThanOrEqual(110);
    expect(height(360)).toBeGreaterThanOrEqual(120);
  });
});

describe("reveal-all order", () => {
  test("lowest rarity first, the best last, draw order within a rarity", () => {
    const items = [item("a", "epic"), item("b", "common"), item("c", "legendary"), item("d", "common")];
    expect(revealAllOrder(items, [false, false, false, false])).toEqual([1, 3, 0, 2]);
    expect(revealAllOrder(items, [false, false, true, false])).toEqual([1, 3, 0]);
  });
});

describe("recap order", () => {
  test("new pieces first, then by rarity (rarest first), then in draw order", () => {
    const items = [item("a", "common", true), item("b", "rare"), item("c", "legendary", true), item("d", "common"), item("e", "epic"), item("f", "rare")];
    expect(recapOrder(items)).toEqual([4, 1, 5, 3, 2, 0]);
  });
});

describe("the sequence", () => {
  const four = [item("a", "epic"), item("b", "common"), item("c", "legendary"), item("d", "common")];

  test("reduced motion and a recovered pull go straight to the recap, everything flipped", () => {
    expect(initialReveal(four, { direct: true })).toMatchObject({ phase: "recap", flipped: [true, true, true, true], top: "legendary" });
    expect(initialReveal(four, { direct: false })).toMatchObject({ phase: "tube", flipped: [false, false, false, false], current: null, queue: [] });
  });

  test("a tap shakes once, then the omen, then the face-down cards", () => {
    const s = run(initialReveal([item("a", "rare")], { direct: false }), { type: "press" }, { type: "release" });
    expect(s.phase).toBe("shaking");
    const omen = run(s, { type: "shakeEnd" });
    expect(omen).toMatchObject({ phase: "omen", top: "rare" });
    expect(run(omen, { type: "omenEnd" })).toMatchObject({ phase: "cards", flipped: [false] });
  });

  test("holding keeps shaking, at most maxShakes cycles; a second press does not restart it", () => {
    let s = run(initialReveal([item("a", "rare")], { direct: false }), { type: "press" });
    expect(revealReducer(s, { type: "press" })).toBe(s);
    for (let i = 1; i < REVEAL.maxShakes; i++) {
      s = revealReducer(s, { type: "shakeEnd" });
      expect(s).toMatchObject({ phase: "shaking", shake: i });
    }
    expect(revealReducer(s, { type: "shakeEnd" }).phase).toBe("omen");
  });

  test("a flip turns the card over and opens its focus view; closing goes back to the cards, then to the recap", () => {
    let s = run(initialReveal(four, { direct: false }), ...DEALT, { type: "flip", index: 2 });
    expect(s).toMatchObject({ phase: "focus", current: 2, flipped: [false, false, true, false] });
    s = run(s, { type: "close" });
    expect(s).toMatchObject({ phase: "cards", current: null });
    for (const i of [0, 1]) s = run(s, { type: "flip", index: i }, { type: "close" });
    expect(s.phase).toBe("cards");
    s = run(s, { type: "flip", index: 3 }, { type: "close" });
    expect(s).toMatchObject({ phase: "recap", flipped: [true, true, true, true] });
  });

  test("touching a card already turned opens it again, without a second signature", () => {
    sig.ids.add("c");
    const s = run(initialReveal(four, { direct: false }), ...DEALT, { type: "flip", index: 2 }, { type: "signatureEnd" }, { type: "close" });
    expect(run(s, { type: "flip", index: 2 })).toMatchObject({ phase: "focus", current: 2 });
  });

  test("a legendary with a registered signature plays it first; one without goes straight to its focus view", () => {
    const dealt = run(initialReveal(four, { direct: false }), ...DEALT);
    expect(run(dealt, { type: "flip", index: 2 }).phase).toBe("focus");
    sig.ids.add("c");
    const signing = run(dealt, { type: "flip", index: 2 });
    expect(signing).toMatchObject({ phase: "signature", current: 2 });
    expect(run(signing, { type: "signatureEnd" })).toMatchObject({ phase: "focus", current: 2 });
    sig.ids.add("a"); // an epic never has one
    expect(run(dealt, { type: "flip", index: 0 }).phase).toBe("focus");
  });

  test("« Tout découvrir » queues the face-down cards lowest rarity first; each close brings the next; then the recap", () => {
    let s = run(initialReveal(four, { direct: false }), ...DEALT, { type: "flip", index: 3 }, { type: "close" }, { type: "revealAll" });
    expect(s).toMatchObject({ phase: "focus", current: 1, queue: [0, 2] });
    const seen = [s.current];
    while (s.phase === "focus") {
      s = run(s, { type: "close" });
      if (s.phase === "focus") seen.push(s.current);
    }
    expect(seen).toEqual([1, 0, 2]);
    expect(s).toMatchObject({ phase: "recap", queue: [], current: null, flipped: [true, true, true, true] });
  });

  test("during « Tout découvrir » the cards turn over by themselves, except a legendary and the last one", () => {
    const s = run(initialReveal(four, { direct: false }), ...DEALT, { type: "revealAll" });
    expect(autoAdvance(s)).toBe(true); // a common, more to come
    const epic = run(s, { type: "close" }, { type: "close" });
    expect(epic.current).toBe(0);
    expect(autoAdvance(epic)).toBe(true);
    const last = run(epic, { type: "close" });
    expect(last.current).toBe(2);
    expect(autoAdvance(last)).toBe(false); // the best piece waits for « Continuer »
    const tapped = run(initialReveal(four, { direct: false }), ...DEALT, { type: "flip", index: 1 });
    expect(autoAdvance(tapped)).toBe(false);
    const twoLegends = [item("x", "legendary"), item("y", "legendary")];
    expect(autoAdvance(run(initialReveal(twoLegends, { direct: false }), ...DEALT, { type: "revealAll" }))).toBe(false);
  });

  test("« Passer » goes to the recap from any phase; the pull itself is never touched", () => {
    const start = initialReveal(four, { direct: false });
    const paths: RevealAction[][] = [
      [],
      [{ type: "press" }],
      [{ type: "press" }, { type: "shakeEnd" }],
      DEALT,
      [...DEALT, { type: "flip", index: 2 }],
      [...DEALT, { type: "revealAll" }],
    ];
    for (const path of paths) {
      const s = run(start, ...path, { type: "skip" });
      expect(s).toMatchObject({ phase: "recap", current: null, queue: [], held: false, flipped: [true, true, true, true] });
      expect(s.items).toBe(start.items);
    }
  });

  test("stray actions are ignored", () => {
    const start = initialReveal(four, { direct: false });
    expect(revealReducer(start, { type: "omenEnd" })).toBe(start);
    expect(revealReducer(start, { type: "flip", index: 0 })).toBe(start);
    expect(revealReducer(start, { type: "close" })).toBe(start);
    expect(revealReducer(start, { type: "revealAll" })).toBe(start);
    const omen = run(start, { type: "press" }, { type: "release" }, { type: "shakeEnd" });
    expect(omen.phase).toBe("omen");
    expect(revealReducer(omen, { type: "flip", index: 0 })).toBe(omen);
    expect(revealReducer(omen, { type: "signatureEnd" })).toBe(omen);
    const dealt = run(omen, { type: "omenEnd" });
    expect(revealReducer(dealt, { type: "flip", index: 42 })).toBe(dealt);
    const focus = run(dealt, { type: "flip", index: 1 });
    expect(revealReducer(focus, { type: "flip", index: 0 })).toBe(focus);
    expect(revealReducer(focus, { type: "revealAll" })).toBe(focus);
    const recap = revealReducer(start, { type: "skip" });
    expect(revealReducer(recap, { type: "press" })).toBe(recap);
    expect(revealReducer(recap, { type: "skip" })).toBe(recap);
  });
});

test("the scroll after a signature: paper there from the first frame, her medallion rising halfway through the unroll", () => {
  // Without a signature (the card flip bridges the gap): unchanged, the paper fades in, then the content, then the seal.
  expect(scrollBeats(0, false)).toEqual({ paper: 0, contentAt: REVEAL.unroll, sealAt: REVEAL.seal });
  expect(scrollBeats(REVEAL.goldHold, false).contentAt).toBe(REVEAL.goldHold + REVEAL.unroll);
  // After a signature: never a bare stage, never an empty scroll.
  const signed = scrollBeats(0, true);
  expect(signed.paper).toBe(1);
  expect(signed.contentAt).toBeLessThan(REVEAL.unroll);
  expect(signed.contentAt).toBeGreaterThan(0);
  expect(signed.contentAt + REVEAL.content).toBeLessThanOrEqual(REVEAL.unroll + 0.1);
  expect(signed.sealAt).toBe(signed.contentAt + REVEAL.content);
});
