import type { Lesson, Round1Answer } from "@/domain/types";
import { commonLessons, DUEL, duelDamage, duelOutcome, duelPrerequisites, duelTime, pickDuelQuestions, round1Blow, round2Blow, toDuelMs } from "@/services/duel";
import { createRng } from "@/services/random";
import { LOCAL_ONLY_EVENT_TYPES } from "@/services/energy";

const r1 = (n: number, correct: boolean, ms: number): Round1Answer[] => Array.from({ length: n }, () => ({ correct, ms }));
const r2 = (n: number, ok: number) => Array.from({ length: n }, (_, i) => ({ correct: i < ok }));
const a = (ms: number, correct = true): Round1Answer => ({ correct, ms });

describe("duelDamage (mirrors duel_damage)", () => {
  test("all correct and fast: 8x15 + 3x15 = 165", () => expect(duelDamage(r1(8, true, 1000), r2(3, 3))).toBe(165));
  test("correct under 300 ms counts 10", () => expect(duelDamage([a(200)], [])).toBe(10));
  test("299 ms = 10, 300 ms = 15", () => expect(duelDamage([a(299), a(300)], [])).toBe(25));
  test("2999 ms = 15, 3000 ms = 10", () => expect(duelDamage([a(2999), a(3000)], [])).toBe(25));
  test("20000 ms = 10, 20001 ms = miss", () => expect(duelDamage([a(20000), a(20001)], [])).toBe(10));
  test("correct over 20 s is a miss", () => expect(duelDamage([a(25000)], [])).toBe(0));
  test("mixed", () =>
    expect(duelDamage([a(1000), a(200), a(25000), a(500, false), a(3000)], [{ correct: true }, { correct: false }])).toBe(50));
  test("rules constants", () => {
    expect(DUEL.hp).toBe(100);
    expect(DUEL.rewards).toEqual({ win: 3, draw: 2, loss: 1, forfeitWin: 3, forfeitAbsent: 0 });
  });
});

describe("duelTime", () => {
  test("sum of ms, each capped at 20000", () => expect(duelTime([a(1000), a(30000), a(200)])).toBe(21200));
  test("empty is 0", () => expect(duelTime([])).toBe(0));
});

describe("duelOutcome", () => {
  test("higher damage wins", () => {
    expect(duelOutcome({ damage: 165, timeMs: 9000 }, { damage: 150, timeMs: 1000 })).toBe("a");
    expect(duelOutcome({ damage: 150, timeMs: 1000 }, { damage: 165, timeMs: 9000 })).toBe("b");
  });
  test("equal damage: lower time wins", () => {
    expect(duelOutcome({ damage: 100, timeMs: 8000 }, { damage: 100, timeMs: 4000 })).toBe("b");
    expect(duelOutcome({ damage: 100, timeMs: 4000 }, { damage: 100, timeMs: 8000 })).toBe("a");
  });
  test("exact tie is a draw", () => expect(duelOutcome({ damage: 100, timeMs: 4000 }, { damage: 100, timeMs: 4000 })).toBe("draw"));
});

describe("toDuelMs", () => {
  test("rounds, clamps negatives and non-finite to a non-negative integer", () => {
    expect(toDuelMs(1234.6)).toBe(1235);
    expect(toDuelMs(-5)).toBe(0);
    expect(toDuelMs(Number.NaN)).toBe(0);
    expect(toDuelMs(Number.POSITIVE_INFINITY)).toBe(0);
    expect(toDuelMs(0.4)).toBe(0);
  });
});

const lesson = (id: string, counts: { tr?: number; li?: number; tone?: number; speak?: number; wo?: number; dep?: number }): Lesson => {
  const ex: Record<string, unknown>[] = [];
  const add = (type: string, n = 0, tag = type) => {
    for (let i = 0; i < n; i++) ex.push({ id: `${id}-${tag}-${i}`, type });
  };
  add("translate_choose", counts.tr);
  add("listen_choose", counts.li);
  add("tone_pick", counts.tone);
  add("speak", counts.speak);
  add("word_order", counts.wo);
  for (let i = 0; i < (counts.dep ?? 0); i++) ex.push({ id: `${id}-dep-${i}`, type: "speak", deprecated: true });
  return { id, exercises: ex } as unknown as Lesson;
};
const typeOf = (l: Lesson[], ref: { lessonId: string; exerciseId: string }) =>
  l.find((x) => x.id === ref.lessonId)?.exercises.find((e) => e.id === ref.exerciseId)?.type;

describe("pickDuelQuestions", () => {
  const lessons = [lesson("l01", { tr: 3, li: 2, tone: 1, speak: 2, wo: 2, dep: 2 }), lesson("l02", { tr: 4, li: 3, speak: 2, wo: 1 })];
  test("counts and types", () => {
    const q = pickDuelQuestions(lessons, createRng(1));
    expect(q?.round1).toHaveLength(8);
    expect(q?.round2).toHaveLength(3);
    for (const r of q?.round1 ?? []) expect(["translate_choose", "listen_choose", "tone_pick"]).toContain(typeOf(lessons, r));
    for (const r of q?.round2 ?? []) expect(typeOf(lessons, r)).toBe("speak");
  });
  test("no repeats, no deprecated, mixes lessons", () => {
    const q = pickDuelQuestions(lessons, createRng(2));
    const all = [...(q?.round1 ?? []), ...(q?.round2 ?? [])];
    expect(new Set(all.map((r) => r.exerciseId)).size).toBe(all.length);
    expect(all.some((r) => r.exerciseId.includes("dep"))).toBe(false);
    expect(new Set((q?.round1 ?? []).map((r) => r.lessonId)).size).toBe(2);
  });
  test("deterministic for a seed", () => {
    expect(pickDuelQuestions(lessons, createRng(7))).toEqual(pickDuelQuestions(lessons, createRng(7)));
  });
  test("fewer than the target is allowed down to the minimums", () => {
    const q = pickDuelQuestions([lesson("l01", { tr: 4, speak: 1 })], createRng(1));
    expect(q?.round1).toHaveLength(4);
    expect(q?.round2).toHaveLength(1);
  });
  test("null below the minimums", () => {
    expect(pickDuelQuestions([lesson("l01", { tr: 3, speak: 2 })], createRng(1))).toBeNull();
    expect(pickDuelQuestions([lesson("l01", { tr: 6, speak: 0, dep: 3 })], createRng(1))).toBeNull();
    expect(pickDuelQuestions([], createRng(1))).toBeNull();
  });
});

describe("prerequisites and common lessons", () => {
  test("needs l01 and d01", () => {
    expect(duelPrerequisites(["l01"], ["d01"])).toBe(true);
    expect(duelPrerequisites(["l02"], ["d01"])).toBe(false);
    expect(duelPrerequisites(["l01"], [])).toBe(false);
  });
  test("intersection", () => {
    expect(commonLessons(["l01", "l02", "l03"], ["l03", "l01", "l09"])).toEqual(["l01", "l03"]);
    expect(commonLessons(["l01"], [])).toEqual([]);
  });
});

test("duel_settled is synced", () => expect(LOCAL_ONLY_EVENT_TYPES).not.toContain("duel_settled"));

describe("per-answer blows (shared by duelDamage and the replay)", () => {
  test.each([
    [{ correct: true, ms: 299 }, "hit", 10],
    [{ correct: true, ms: 300 }, "critical", 15],
    [{ correct: true, ms: 2999 }, "critical", 15],
    [{ correct: true, ms: 3000 }, "hit", 10],
    [{ correct: true, ms: 20000 }, "hit", 10],
    [{ correct: true, ms: 20001 }, "miss", 0],
    [{ correct: false, ms: 1000 }, "miss", 0],
  ] as const)("round 1 %o → %s %i", (answer, kind, damage) => {
    expect(round1Blow(answer)).toEqual({ kind, damage });
  });

  test("round 2: recognised = 15, otherwise a miss", () => {
    expect(round2Blow({ correct: true })).toEqual({ kind: "hit", damage: DUEL.oral });
    expect(round2Blow({ correct: false })).toEqual({ kind: "miss", damage: 0 });
  });

  test("duelDamage is the sum of the blows", () => {
    const r1 = [{ correct: true, ms: 1000 }, { correct: true, ms: 100 }, { correct: false, ms: 1000 }, { correct: true, ms: 25000 }];
    const r2 = [{ correct: true }, { correct: false }];
    const sum = r1.reduce((s, a) => s + round1Blow(a).damage, 0) + r2.reduce((s, a) => s + round2Blow(a).damage, 0);
    expect(duelDamage(r1, r2)).toBe(sum);
    expect(sum).toBe(15 + 10 + 15);
  });
});
