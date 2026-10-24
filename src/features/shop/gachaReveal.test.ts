import { describe, expect, test } from "vitest";
import type { GachaPullItem } from "@/domain/types";
import { duration } from "@/ui/motion";
import {
  BUDGET,
  fallSchedule,
  fallTotal,
  initialReveal,
  MOUTH,
  peakConcurrency,
  REVEAL,
  recapOrder,
  revealReducer,
  slotsFor,
  STAGE,
  type RevealAction,
  type RevealState,
} from "@/features/shop/gachaReveal";

const item = (itemId: string, rarity: GachaPullItem["rarity"], duplicate = false): GachaPullItem => ({ itemId, rarity, duplicate, refund: duplicate ? 8 : 0 });
const run = (s: RevealState, ...actions: RevealAction[]) => actions.reduce(revealReducer, s);

describe("timing tokens", () => {
  test("every beat is composed from the motion tokens", () => {
    expect(REVEAL.shake).toBe(duration.slow * 2);
    expect(REVEAL.fall).toBe(duration.slow);
    expect(REVEAL.fallStagger).toBe(duration.fast);
    expect(REVEAL.unroll).toBe(duration.slow);
    expect(REVEAL.legendaryHold).toBe(duration.slow + duration.celebrate);
    expect(REVEAL.legendaryHold).toBeGreaterThan(REVEAL.unroll); // the gold stick holds longer than a plain reveal
  });

  test("a x1 falls at once; a x10 is staggered and lands within 2 s", () => {
    expect(fallSchedule(1)).toEqual([{ delay: 0, length: REVEAL.fall }]);
    const ten = fallSchedule(10);
    expect(ten).toHaveLength(10);
    expect(ten.map((s) => s.delay)).toEqual(Array.from({ length: 10 }, (_, i) => i * REVEAL.fallStagger));
    expect(fallTotal(10)).toBeCloseTo(9 * REVEAL.fallStagger + REVEAL.fall);
    expect(fallTotal(10)).toBeLessThan(2);
  });

  test("the fan stays within the budget of 8 animated elements (the fading tube included)", () => {
    expect(peakConcurrency(fallSchedule(10)) + 1).toBeLessThanOrEqual(BUDGET.animated);
    expect(peakConcurrency([{ delay: 0, length: 1 }, { delay: 0.5, length: 1 }, { delay: 1, length: 1 }])).toBe(2);
  });

  test("the shake is bounded: no infinite loop", () => {
    expect(REVEAL.maxShakes).toBeGreaterThan(1);
    expect(REVEAL.maxShakes * REVEAL.shake).toBeLessThan(3);
  });
});

describe("stage geometry", () => {
  test("constant slots inside the stage, one per stick, touch targets at least 44 px", () => {
    for (const n of [1, 10]) {
      const slots = slotsFor(n);
      expect(slots).toHaveLength(n);
      for (const s of slots) {
        expect(s.w).toBeGreaterThanOrEqual(44);
        expect(s.h).toBeGreaterThanOrEqual(44);
        expect(s.hit).toBeGreaterThanOrEqual(44);
        expect(s.hit).toBeLessThanOrEqual(s.h);
        expect(s.x - s.w / 2).toBeGreaterThanOrEqual(0);
        expect(s.x + s.w / 2).toBeLessThanOrEqual(STAGE.w);
        expect(s.y + s.h / 2).toBeLessThanOrEqual(STAGE.h);
      }
    }
  });

  test("the ten sticks do not share a centre (two staggered rows), and they all leave from the tube mouth", () => {
    const slots = slotsFor(10);
    expect(new Set(slots.map((s) => `${s.x},${s.y}`)).size).toBe(10);
    expect(new Set(slots.map((s) => s.y)).size).toBe(2);
    expect(MOUTH.x).toBe(STAGE.w / 2);
  });

  test("the back row stands on the tray too, its tips rising at least 44 px above the front row", () => {
    const slots = slotsFor(10);
    const back = slots.slice(0, 5);
    const front = slots.slice(5);
    const bottom = (s: (typeof slots)[number]) => s.y + s.h / 2;
    expect(new Set(slots.map(bottom)).size).toBe(1);
    for (const b of back) for (const f of front) expect(f.y - f.h / 2 - (b.y - b.h / 2)).toBeGreaterThanOrEqual(44);
    for (const b of back) expect(b.hit).toBeLessThan(b.h); // touches only on the tip, never under the front row
    expect(slots.every((s) => s.pivot === "bottom")).toBe(true);
  });

  test("other counts fall back to rows of five", () => {
    expect(slotsFor(3)).toHaveLength(3);
  });
});

describe("recap order", () => {
  test("new pieces first, then by rarity (rarest first), then in draw order", () => {
    const items = [
      item("a", "common", true),
      item("b", "rare"),
      item("c", "legendary", true),
      item("d", "common"),
      item("e", "epic"),
      item("f", "rare"),
    ];
    expect(recapOrder(items)).toEqual([4, 1, 5, 3, 2, 0]);
  });
});

describe("the sequence", () => {
  const ten = [item("a", "common"), item("b", "legendary"), ...Array.from({ length: 8 }, (_, i) => item(`c${i}`, "rare", i % 2 === 0))];

  test("reduced motion and a recovered pull go straight to the recap, everything revealed", () => {
    expect(initialReveal(ten, { direct: true })).toMatchObject({ phase: "recap", revealed: Array(10).fill(true) });
    expect(initialReveal(ten, { direct: false })).toMatchObject({ phase: "tube", revealed: Array(10).fill(false) });
  });

  test("a tap shakes once, then the stick falls", () => {
    const s = run(initialReveal([item("a", "rare")], { direct: false }), { type: "press" }, { type: "release" });
    expect(s.phase).toBe("shaking");
    expect(run(s, { type: "shakeEnd" }).phase).toBe("falling");
  });

  test("holding keeps shaking, at most maxShakes cycles", () => {
    let s = run(initialReveal([item("a", "rare")], { direct: false }), { type: "press" });
    for (let i = 1; i < REVEAL.maxShakes; i++) {
      s = revealReducer(s, { type: "shakeEnd" });
      expect(s).toMatchObject({ phase: "shaking", shake: i });
    }
    expect(revealReducer(s, { type: "shakeEnd" }).phase).toBe("falling");
  });

  test("a second press while shaking does not restart the shake", () => {
    const s = run(initialReveal([item("a", "rare")], { direct: false }), { type: "press" });
    expect(revealReducer(s, { type: "press" })).toBe(s);
  });

  test("a common stick unrolls at once; a legendary one holds first, then unrolls with the confetti", () => {
    const fallen = run(initialReveal(ten, { direct: false }), { type: "press" }, { type: "release" }, { type: "shakeEnd" }, { type: "fallen" });
    expect(fallen.phase).toBe("altar");
    expect(run(fallen, { type: "open", index: 0 })).toMatchObject({ phase: "scroll", current: 0 });
    const held = run(fallen, { type: "open", index: 1 });
    expect(held).toMatchObject({ phase: "hold", current: 1, burst: 0 });
    const unrolled = run(held, { type: "holdEnd" });
    expect(unrolled).toMatchObject({ phase: "scroll", current: 1, burst: 1 });
  });

  test("the confetti fire once, even when a legendary scroll is opened again", () => {
    const fallen = run(initialReveal(ten, { direct: false }), { type: "press" }, { type: "release" }, { type: "shakeEnd" }, { type: "fallen" });
    const once = run(fallen, { type: "open", index: 1 }, { type: "holdEnd" }, { type: "close" });
    expect(once.burst).toBe(1);
    const again = run(once, { type: "open", index: 1 });
    expect(again.phase).toBe("scroll"); // already seen: no second hold
    expect(again.burst).toBe(1);
  });

  test("closing a scroll goes back to the altar, and to the recap once every stick is read", () => {
    let s = run(initialReveal(ten, { direct: false }), { type: "press" }, { type: "release" }, { type: "shakeEnd" }, { type: "fallen" });
    for (let i = 0; i < 10; i++) {
      s = run(s, { type: "open", index: i }, { type: "holdEnd" }, { type: "close" });
      expect(s.phase).toBe(i < 9 ? "altar" : "recap");
    }
  });

  test("« Tout révéler » and « Passer » go to the recap from any phase; the pull itself is never touched", () => {
    const start = initialReveal(ten, { direct: false });
    const phases: RevealAction[][] = [[], [{ type: "press" }], [{ type: "press" }, { type: "shakeEnd" }], [{ type: "press" }, { type: "release" }, { type: "shakeEnd" }, { type: "fallen" }, { type: "open", index: 1 }]];
    for (const path of phases) {
      for (const end of [{ type: "skip" }, { type: "revealAll" }] as RevealAction[]) {
        const s = run(start, ...path, end);
        expect(s.phase).toBe("recap");
        expect(s.revealed.every(Boolean)).toBe(true);
        expect(s.items).toBe(start.items);
      }
    }
  });

  test("stray actions are ignored", () => {
    const start = initialReveal(ten, { direct: false });
    expect(revealReducer(start, { type: "fallen" })).toBe(start);
    expect(revealReducer(start, { type: "open", index: 0 })).toBe(start);
    expect(revealReducer(start, { type: "close" })).toBe(start);
    const fallen = run(start, { type: "press" }, { type: "release" }, { type: "shakeEnd" }, { type: "fallen" });
    expect(revealReducer(fallen, { type: "open", index: 42 })).toBe(fallen);
    const recap = revealReducer(start, { type: "skip" });
    expect(revealReducer(recap, { type: "press" })).toBe(recap);
  });
});
