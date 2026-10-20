import { describe, expect, test } from "vitest";
import type { DuelRun } from "@/domain/types";
import { duelDamage, duelTime } from "@/services/duel";
import { duelReplay, replaySchedule, replayStats, REPLAY_BUDGET, type ReplayBeat } from "@/features/duels/duelReplay";
import { blowTiming, missTiming } from "@/ui/fight";
import { duration } from "@/ui";

function run(round1: { correct: boolean; ms: number }[], round2: { correct: boolean }[]): DuelRun {
  return { round1, round2, damage: duelDamage(round1, round2), timeMs: duelTime(round1), reward: null, claimed: false };
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

type A1 = { correct: boolean; ms: number };
const HIT: A1 = { correct: true, ms: 5000 };
const CRIT: A1 = { correct: true, ms: 1000 };
const MISS: A1 = { correct: false, ms: 5000 };
const ORAL = { correct: true };
const MUTE = { correct: false };
const label = (b: ReplayBeat): string =>
  b.type === "banner"
    ? `R${b.round}`
    : b.type === "blow"
      ? `${b.step.attacker}:${b.step.kind}${b.ko ? ":ko" : ""}${b.tempo === 2 ? ":x2" : ""}`
      : b.type === "misses"
        ? `miss:${b.misses.map((m) => `${m.attacker}${m.count}`).join("+")}${b.tempo === 2 ? ":x2" : ""}`
        : b.type;

/** Deterministic PRNG for the property checks. */
function prng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("replaySchedule", () => {
  test("round banners, one beat per landed blow, the finale; beats follow each other without gaps", () => {
    const mine = run([CRIT, HIT], [ORAL]);
    const theirs = run([MISS, HIT], [ORAL]);
    const { beats, total } = replaySchedule(duelReplay(mine, theirs, true));
    expect(beats.map(label)).toEqual(["R1", "me:critical", "miss:them1", "me:hit", "them:hit", "R2", "me:hit", "them:hit", "finale"]);
    let t = 0;
    for (const b of beats) {
      expect(b.start).toBeCloseTo(t, 9);
      t += b.length;
    }
    expect(total).toBeCloseTo(t, 9);
    // Lengths come from the fight tokens: a banner is `celebrate`, a blow hands over at the end of the recoil.
    expect(beats[0]?.length).toBe(duration.celebrate);
    expect(beats[1]?.length).toBeCloseTo(blowTiming("crit").length, 9);
    expect(beats[2]?.length).toBeCloseTo(missTiming().length, 9);
    expect(beats[3]?.length).toBeCloseTo(blowTiming("hit").length, 9);
    expect(beats.at(-1)?.length).toBe(duration.celebrate);
  });

  test("consecutive misses are one beat, counted per attacker", () => {
    const mine = run([MISS, MISS, MISS, HIT], [MUTE, MUTE]);
    const theirs = run([HIT, MISS, MISS, MISS], [MUTE, ORAL]);
    const labels = replaySchedule(duelReplay(mine, theirs, true)).beats.map(label);
    expect(labels).toEqual(["R1", "miss:me1", "them:hit", "miss:me2+them2", "me:hit", "miss:them1", "R2", "miss:me2+them1", "them:hit", "finale"]);
    // In a forfeit only one player attacks: three misses in a row are « Raté ×3 ».
    const solo = replaySchedule(duelReplay(run([MISS, MISS, MISS, HIT], [ORAL]), null, true)).beats.map(label);
    expect(solo).toEqual(["R1", "miss:me3", "me:hit", "R2", "me:hit", "finale"]);
  });

  test("a group of misses never spans a round banner", () => {
    const labels = replaySchedule(duelReplay(run([HIT, MISS], [MUTE]), null, true)).beats.map(label);
    expect(labels).toEqual(["R1", "me:hit", "miss:me1", "R2", "miss:me1", "finale"]);
  });

  test("the K.-O. blow holds longer; the blows after it run twice as fast", () => {
    const strong = run([CRIT, CRIT, CRIT, CRIT, CRIT, CRIT, CRIT, MISS], [ORAL]);
    const { beats, total } = replaySchedule(duelReplay(strong, null, true));
    expect(beats.map(label)).toEqual([
      "R1",
      ...Array.from({ length: 6 }, () => "me:critical"),
      "me:critical:ko", // 7 × 15 = 105
      "miss:me1:x2",
      "R2",
      "me:hit:x2",
      "finale",
    ]);
    const ko = beats.find((b) => b.type === "blow" && b.ko);
    expect(ko?.type === "blow" && ko.step.hpThem).toBe(0);
    expect(ko?.length).toBeCloseTo(blowTiming("crit", { ko: true }).length, 9);
    expect(total).toBeLessThanOrEqual(REPLAY_BUDGET);
  });

  test("when even twice as fast overruns the budget, the blows after the K.-O. are summed up in one beat", () => {
    const strong = run(Array.from({ length: 8 }, () => HIT), [ORAL, ORAL, ORAL]);
    const weak = run(Array.from({ length: 8 }, () => MISS), [MUTE, MUTE, MUTE]);
    const steps = duelReplay(strong, weak, true);
    const { beats, total } = replaySchedule(steps);
    const at = beats.findIndex((b) => b.type === "blow" && b.ko);
    expect(beats[at]?.type === "blow" && beats[at].tempo).toBe(1);
    const flurry = beats[at + 1];
    expect(flurry?.type).toBe("flurry");
    // 8 × 10 = 80, the first oral 95, the second one K.-O.: the last oral and two misses remain.
    expect(flurry?.type === "flurry" && flurry.steps.map((s) => `${s.attacker}:${s.kind}`)).toEqual(["them:miss", "me:hit", "them:miss"]);
    expect(beats[at + 2]?.type).toBe("finale");
    expect(total).toBeLessThanOrEqual(REPLAY_BUDGET);
    // The blows before the K.-O. share one quicker tempo.
    const tempos = new Set(beats.slice(0, at).flatMap((b) => ("tempo" in b ? [b.tempo] : [])));
    expect(tempos.size).toBe(1);
    expect([...tempos][0]).toBeGreaterThan(1);
  });

  test("a full 8 + 3 duel replays in 9 s at most", () => {
    const all = (a: A1) => Array.from({ length: 8 }, () => a);
    const cases: [DuelRun | null, DuelRun | null][] = [
      [run(all(CRIT), [ORAL, ORAL, ORAL]), run(all(CRIT), [ORAL, ORAL, ORAL])],
      [run(all(HIT), [ORAL, ORAL, ORAL]), run(all(HIT), [ORAL, ORAL, ORAL])],
      // No K.-O.: 95 damage each, as many landed blows as possible.
      [run([CRIT, CRIT, CRIT, CRIT, CRIT, HIT, HIT, MISS], [MUTE, MUTE, MUTE]), run([MISS, CRIT, CRIT, CRIT, CRIT, CRIT, HIT, HIT], [MUTE, MUTE, MUTE])],
      [run([HIT, HIT, HIT, HIT, HIT, HIT, HIT, HIT], [ORAL, MUTE, MUTE]), run([HIT, HIT, HIT, HIT, HIT, HIT, HIT, HIT], [MUTE, MUTE, ORAL])],
      [run([CRIT, MISS, CRIT, MISS, CRIT, MISS, CRIT, MISS], [ORAL, MUTE, ORAL]), run([MISS, CRIT, MISS, CRIT, MISS, CRIT, MISS, CRIT], [MUTE, ORAL, MUTE])],
      [run(all(MISS), [MUTE, MUTE, MUTE]), run(all(MISS), [MUTE, MUTE, MUTE])],
      [run(all(CRIT), [ORAL, ORAL, ORAL]), null],
    ];
    for (const [a, b] of cases) {
      for (const meFirst of [true, false]) {
        const { beats, total } = replaySchedule(duelReplay(a, b, meFirst));
        expect(total).toBeLessThanOrEqual(REPLAY_BUDGET);
        expect(beats.at(-1)?.type).toBe("finale");
      }
    }
    // Any full duel.
    const rnd = prng(2026);
    const pick = (): A1 => [HIT, CRIT, MISS][Math.floor(rnd() * 3)] ?? HIT;
    const oral = () => (rnd() < 0.5 ? ORAL : MUTE);
    for (let i = 0; i < 3000; i++) {
      const a = run(Array.from({ length: 8 }, pick), [oral(), oral(), oral()]);
      const b = run(Array.from({ length: 8 }, pick), [oral(), oral(), oral()]);
      expect(replaySchedule(duelReplay(a, b, rnd() < 0.5)).total).toBeLessThanOrEqual(REPLAY_BUDGET);
    }
  });

  test("a short duel keeps the normal tempo", () => {
    const mine = run([CRIT, HIT, MISS, HIT], [ORAL]);
    const theirs = run([HIT, MISS, CRIT, HIT], [MUTE]);
    const { beats } = replaySchedule(duelReplay(mine, theirs, true));
    expect(beats.every((b) => !("tempo" in b) || b.tempo === 1)).toBe(true);
  });

  test("nothing to replay: no beat", () => {
    expect(replaySchedule([])).toEqual({ beats: [], total: 0 });
  });
});
