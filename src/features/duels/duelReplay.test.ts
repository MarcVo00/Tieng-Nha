import { describe, expect, test } from "vitest";
import type { DuelRun } from "@/domain/types";
import { duelDamage, duelTime } from "@/services/duel";
import { duelReplay, replayStats } from "@/features/duels/duelReplay";

function run(round1: { correct: boolean; ms: number }[], round2: { correct: boolean }[]): DuelRun {
  return { round1, round2, damage: duelDamage(round1, round2), timeMs: duelTime(round1), reward: null };
}

describe("duelReplay", () => {
  test("alternates question by question, the challenger first, round 1 then round 2", () => {
    const mine = run(
      [{ correct: true, ms: 1500 }, { correct: true, ms: 5000 }, { correct: false, ms: 2000 }, { correct: true, ms: 200 }],
      [{ correct: true }, { correct: false }],
    );
    const theirs = run(
      [{ correct: false, ms: 4000 }, { correct: true, ms: 2999 }, { correct: true, ms: 25000 }, { correct: true, ms: 300 }],
      [{ correct: false }, { correct: true }],
    );
    const steps = duelReplay(mine, theirs, true);
    expect(steps.map((s) => `${s.round}${s.attacker}:${s.kind}:${s.damage}`)).toEqual([
      "1me:critical:15",
      "1them:miss:0",
      "1me:hit:10",
      "1them:critical:15",
      "1me:miss:0",
      "1them:miss:0", // over 20 s
      "1me:hit:10", // under 300 ms: no critical
      "1them:critical:15",
      "2me:hit:15",
      "2them:miss:0",
      "2me:miss:0",
      "2them:hit:15",
    ]);
    const last = steps.at(-1);
    expect(last?.hpThem).toBe(100 - mine.damage);
    expect(last?.hpMe).toBe(100 - theirs.damage);
    expect(steps[0]).toMatchObject({ hpMe: 100, hpThem: 85 });
    expect(steps[3]).toMatchObject({ hpMe: 85, hpThem: 75 });
  });

  test("the opponent attacks first when they challenged me", () => {
    const mine = run([{ correct: true, ms: 4000 }], [{ correct: true }]);
    const theirs = run([{ correct: true, ms: 4000 }], [{ correct: false }]);
    expect(duelReplay(mine, theirs, false).map((s) => s.attacker)).toEqual(["them", "me", "them", "me"]);
  });

  test("a KO before the end floors the HP at 0 and the remaining blows still play", () => {
    const strong = run(Array.from({ length: 8 }, () => ({ correct: true, ms: 1000 })), [{ correct: true }, { correct: true }, { correct: true }]);
    const weak = run(Array.from({ length: 8 }, () => ({ correct: false, ms: 6000 })), [{ correct: false }, { correct: false }, { correct: false }]);
    const steps = duelReplay(strong, weak, true);
    expect(steps).toHaveLength(22);
    const ko = steps.findIndex((s) => s.hpThem === 0);
    expect(ko).toBe(12); // 7th blow: 7 × 15 = 105
    expect(steps.slice(ko).every((s) => s.hpThem === 0)).toBe(true);
    expect(steps.every((s) => s.hpMe === 100)).toBe(true);
  });

  test("forfeit: only the present player attacks", () => {
    const mine = run([{ correct: true, ms: 1000 }, { correct: true, ms: 9000 }], [{ correct: true }]);
    const steps = duelReplay(mine, null, false);
    expect(steps.map((s) => s.attacker)).toEqual(["me", "me", "me"]);
    expect(steps.map((s) => s.hpThem)).toEqual([85, 75, 60]);
    expect(steps.every((s) => s.hpMe === 100)).toBe(true);
  });

  test("forfeit the other way: I was absent, only they attack", () => {
    const theirs = run([{ correct: true, ms: 1000 }], [{ correct: false }]);
    expect(duelReplay(null, theirs, true).map((s) => `${s.attacker}:${s.kind}:${s.hpMe}`)).toEqual(["them:critical:85", "them:miss:85"]);
  });
});

describe("replayStats", () => {
  test("counts criticals and keeps the server totals", () => {
    const r = run([{ correct: true, ms: 1000 }, { correct: true, ms: 500 }, { correct: true, ms: 100 }], [{ correct: true }]);
    expect(replayStats(r)).toEqual({ damage: 10 + 15 + 15 + 15, criticals: 2, timeMs: 1600 });
    expect(replayStats(null)).toBeNull();
  });
});
